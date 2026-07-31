/**
 * Do11y — Documentation Observability
 *
 * OpenTelemetry Instrumentation for documentation sites.
 *
 * This is the npm/bundler distribution path. Users install
 * @opentelemetry/browser-sdk and @manototh/do11y, then register
 * DocsInstrumentation to get docs-specific events (scroll depth,
 * tab switches, code copies, etc.) flowing through the same OTel
 * pipeline as their auto-instrumentations.
 *
 * Example:
 *   import { startLogsSdk } from '@opentelemetry/browser-sdk/logs';
 *   import { DocsInstrumentation } from '@manototh/do11y/instrumentation';
 *
 *   startLogsSdk({
 *     serviceName: 'my-docs',
 *     logs: { exportConfig: { url: 'https://otel.example.com/v1/logs' } },
 *   });
 *
 *   // DocsInstrumentation self-enables on construction; the LoggerProvider
 *   // must be registered first (see startLogsSdk above).
 *   new DocsInstrumentation({ framework: 'mintlify' });
 */
import { InstrumentationBase } from "@opentelemetry/instrumentation";
import { logs, type LogAttributes } from "@opentelemetry/api-logs";
import type { Do11yConfig, EmitFn } from "../core/types.js";
import {
  VERSION,
  ATTR_SESSION_ID,
  ATTR_DO11Y_SESSION_PAGE_COUNT,
  ATTR_DO11Y_DO11Y_VERSION,
} from "../core/constants.js";
import { applyFrameworkSelectors } from "../core/presets.js";
import { shouldDisableTracking } from "../core/privacy.js";
import { getBrowserContext } from "../core/context.js";
import { getPageInfo } from "../core/context.js";
import { getSession } from "../core/session.js";
import { trackPageView } from "../core/tracking/page-view.js";
import { setupLinkTracking } from "../core/tracking/links.js";
import {
  setupScrollTracking,
  resetTrackedScrollDepths,
  checkScrollDepth,
} from "../core/tracking/scroll.js";
import {
  setupEngagementTracking,
  emitPageExit,
  resetEngagementState,
} from "../core/tracking/engagement.js";
import { setupSearchTracking } from "../core/tracking/search.js";
import { setupCopyTracking } from "../core/tracking/copy.js";
import {
  setupSectionVisibilityTracking,
  disconnectSectionObserver,
  observeHeadings,
} from "../core/tracking/sections.js";
import { setupTabSwitchTracking } from "../core/tracking/tabs.js";
import { setupTocClickTracking } from "../core/tracking/toc.js";
import { setupFeedbackTracking } from "../core/tracking/feedback.js";
import { setupExpandCollapseTracking } from "../core/tracking/expand.js";
import { createRateLimiter, DEFAULT_RATE_LIMIT_MS } from "../core/rate-limit.js";
import type { DocsInstrumentationConfig } from "./config.js";
import { buildConfig } from "./config.js";

export type { DocsInstrumentationConfig } from "./config.js";

/**
 * True once a global LoggerProvider is registered. Before registration,
 * logs.getLoggerProvider() returns api-logs' ProxyLoggerProvider, which
 * exposes an internal `_setDelegate` method; real providers (e.g. sdk-logs
 * LoggerProvider) do not. api-logs version negotiation shares the same
 * proxy across copies, so this holds regardless of which copy registered.
 */
function providerIsRegistered(): boolean {
  try {
    const provider = logs.getLoggerProvider() as { _setDelegate?: unknown };
    return typeof provider._setDelegate !== "function";
  } catch {
    // If detection ever fails, fall back to direct emit (no buffering).
    return true;
  }
}

/**
 * OpenTelemetry instrumentation for documentation sites.
 *
 * Emits log records for documentation-specific events (page views,
 * scroll depth, tab switches, code copies, etc.) through the
 * OpenTelemetry API. Works alongside @opentelemetry/browser-sdk
 * and other browser instrumentations.
 */
export class DocsInstrumentation extends InstrumentationBase<DocsInstrumentationConfig> {
  // NOTE: no field initializers here. The browser build of InstrumentationBase
  // calls enable() from its constructor — BEFORE subclass field initializers
  // run. An initializer like `= {}` or `= null` would therefore run AFTER
  // enable() and wipe the config/state it set during construction (the
  // self-enabling path used by the docs). That silently disabled debug logging
  // and sessionAttributes, and left disable() unable to find the SPA observers.
  // Definite-assignment (`!`) keeps enable()/disable() the sole owners.
  private _do11yConfig!: Partial<Do11yConfig>;
  private _emit!: EmitFn;
  private _mutationObserver!: MutationObserver | null;
  private _pathPollId!: ReturnType<typeof setInterval> | null;
  private _lastPath!: string;
  private _boundHandlePathChange!: (() => void) | null;
  private _boundPopstateHandler!: (() => void) | null;
  private _drainTimer!: ReturnType<typeof setInterval> | null;

  constructor(config: DocsInstrumentationConfig = {}) {
    super("@manototh/do11y", VERSION, config);
  }

  /**
   * Init is called by the base class constructor.
   * For browser instrumentations that don't patch Node.js modules,
   * this can return void.
   */
  init(): void {
    // Initialization happens in enable()
  }

  /**
   * Enable the instrumentation: register all DOM event listeners.
   */
  override enable(): void {
    const userConfig = this.getConfig() as DocsInstrumentationConfig;
    this._do11yConfig = buildConfig(userConfig);

    // Apply framework presets to resolve selectors
    applyFrameworkSelectors(this._do11yConfig as Do11yConfig);

    // Honor the same privacy rules as the standalone build: respect the
    // visitor's Do Not Track preference and the allowed-domains allowlist.
    // When disabled, skip wiring entirely (shouldDisableTracking logs why
    // when debug is on).
    if (shouldDisableTracking(this._do11yConfig as Do11yConfig)) {
      return;
    }

    if (this._do11yConfig.debug) {
      console.log("[Do11y] Instrumentation enabled:", this._do11yConfig.framework);
    }

    // Surface the pre-init window: without a provider, api-logs would drop
    // records. We buffer and replay them, but the host should really start
    // the OTel SDK before constructing the instrumentation.
    if (!providerIsRegistered()) {
      console.warn(
        "[Do11y] No LoggerProvider registered yet — events will be buffered " +
          "and replayed once the OTel SDK is started. Call startLogsSdk()/" +
          "startBrowserSdk() BEFORE creating DocsInstrumentation.",
      );
    }

    // Create emit function backed by the OTel Logger, rate-limited to match
    // the standalone transport so rapid duplicate events don't spam the
    // collector while distinct scroll milestones still get through. The
    // limiter is created here (not as a class field) because the base class
    // constructor calls enable() before subclass field initializers run.
    const rateLimiter = createRateLimiter();

    // ── Pending-event buffer ────────────────────────────────────────────────
    // api-logs silently drops records emitted before a LoggerProvider is
    // registered (its ProxyLogger resolves to NOOP_LOGGER until a delegate is
    // set). Buffer such events and replay them once a provider appears,
    // mirroring the standalone transport's OTLP buffer. Everything here is
    // closure-local for the same reason the rate limiter is: the base class
    // constructor calls enable() before subclass field initializers run.
    const MAX_PENDING = 500;
    const pending: Array<{
      eventName: string;
      attributes: LogAttributes;
      timestamp: number;
    }> = [];

    // Build the full attribute set for a record (session, browser and page
    // context). Typed as LogAttributes so buffered replays stay compatible
    // with the OTel API.
    const buildAttributes = (eventData: Record<string, unknown>): LogAttributes => {
      const sessionAttributes: LogAttributes =
        this._do11yConfig.sessionAttributes !== false
          ? {
              [ATTR_SESSION_ID]: getSession().id,
              [ATTR_DO11Y_SESSION_PAGE_COUNT]: getSession().pageCount,
            }
          : {};
      return {
        [ATTR_DO11Y_DO11Y_VERSION]: VERSION,
        ...sessionAttributes,
        ...getBrowserContext(),
        ...getPageInfo(),
        ...eventData,
      };
    };

    const drainPending = (): void => {
      if (pending.length === 0) return;
      const logger = logs.getLogger("@manototh/do11y");
      for (const evt of pending) {
        logger.emit({
          eventName: evt.eventName,
          severityNumber: 9, // SEVERITY_NUMBER_INFO
          timestamp: evt.timestamp,
          attributes: evt.attributes,
          body: "",
        });
      }
      if (this._do11yConfig.debug) {
        console.log(
          "[Do11y] Replayed",
          pending.length,
          "buffered events after LoggerProvider registration",
        );
      }
      pending.length = 0;
    };

    // Poll until a provider is registered so a lone buffered event (e.g. the
    // initial page_view) is replayed even if no further events arrive. The
    // timer clears itself once drained and is torn down in disable().
    const startDrainTimer = (): void => {
      if (this._drainTimer !== null) return;
      this._drainTimer = window.setInterval(() => {
        if (providerIsRegistered()) {
          if (this._drainTimer !== null) {
            clearInterval(this._drainTimer);
            this._drainTimer = null;
          }
          drainPending();
        }
      }, 100);
    };

    const emit: EmitFn = (eventName, eventData) => {
      if (
        !rateLimiter.allow(
          eventName,
          eventData,
          this._do11yConfig.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS,
          this._do11yConfig.debug ?? false,
        )
      ) {
        return;
      }

      // Mirror the standalone build's debug logging so emitted events are
      // visible in the console when `debug` is enabled.
      if (this._do11yConfig.debug) {
        console.log("[Do11y] Event:", eventName, eventData);
      }

      // Build the full attribute set up front so a buffered replay is
      // faithful to the original emit (session, browser and page context).
      const fullAttributes = buildAttributes(eventData);

      if (!providerIsRegistered()) {
        // No LoggerProvider yet — buffer instead of silently dropping.
        if (pending.length >= MAX_PENDING) {
          if (this._do11yConfig.debug) {
            console.log("[Do11y] Pending buffer full; dropping event:", eventName);
          }
          return;
        }
        pending.push({
          eventName,
          attributes: fullAttributes,
          timestamp: Date.now(),
        });
        startDrainTimer();
        return;
      }

      // Provider is registered: flush any buffered events first, then emit.
      drainPending();
      logs.getLogger("@manototh/do11y").emit({
        eventName,
        severityNumber: 9, // SEVERITY_NUMBER_INFO
        timestamp: Date.now(),
        attributes: fullAttributes,
        body: "",
      });
    };
    this._emit = emit;

    // Wire up all tracking modules
    trackPageView(this._do11yConfig as Do11yConfig, emit);
    setupLinkTracking(this._do11yConfig as Do11yConfig, emit);
    setupScrollTracking(this._do11yConfig as Do11yConfig, emit);
    setupEngagementTracking(this._do11yConfig as Do11yConfig, emit);
    setupSearchTracking(this._do11yConfig as Do11yConfig, emit);
    setupCopyTracking(this._do11yConfig as Do11yConfig, emit);
    setupSectionVisibilityTracking(this._do11yConfig as Do11yConfig, emit);
    setupTabSwitchTracking(this._do11yConfig as Do11yConfig, emit);
    setupTocClickTracking(this._do11yConfig as Do11yConfig, emit);
    setupFeedbackTracking(this._do11yConfig as Do11yConfig, emit);
    setupExpandCollapseTracking(this._do11yConfig as Do11yConfig, emit);

    // SPA path-change detection
    if (this._do11yConfig.trackSpaPathChanges) {
      this._lastPath = window.location.pathname;

      const config = this._do11yConfig as Do11yConfig;
      this._boundHandlePathChange = (): void => {
        if (window.location.pathname === this._lastPath) return;
        this._lastPath = window.location.pathname;
        emitPageExit(config, emit);
        resetTrackedScrollDepths();
        resetEngagementState();
        trackPageView(config, emit);
        observeHeadings();
        checkScrollDepth(config, emit);
      };

      this._boundPopstateHandler = this._boundHandlePathChange;
      window.addEventListener("popstate", this._boundPopstateHandler);

      this._mutationObserver = new MutationObserver(this._boundHandlePathChange);
      this._mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      this._pathPollId = window.setInterval(this._boundHandlePathChange, 200);
    }
  }

  /**
   * Disable the instrumentation: tear down all event listeners and observers.
   */
  override disable(): void {
    disconnectSectionObserver();

    // Stop the pending-event drain poll
    if (this._drainTimer !== null) {
      clearInterval(this._drainTimer);
      this._drainTimer = null;
    }

    // Tear down SPA tracking
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    if (this._pathPollId !== null) {
      clearInterval(this._pathPollId);
      this._pathPollId = null;
    }
    if (this._boundPopstateHandler) {
      window.removeEventListener("popstate", this._boundPopstateHandler);
      this._boundPopstateHandler = null;
    }
    this._boundHandlePathChange = null;
    this._lastPath = "";
    this._emit = () => {};

    this._do11yConfig = {};
  }
}
