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
 *   import { startBrowserSdk } from '@opentelemetry/browser-sdk';
 *   import { DocsInstrumentation } from '@manototh/do11y/instrumentation';
 *
 *   startBrowserSdk({
 *     serviceName: 'my-docs',
 *     exportConfig: { url: 'https://otel.example.com/v1/logs' },
 *     instrumentations: [
 *       new DocsInstrumentation({ framework: 'mintlify' }),
 *     ],
 *   });
 */
import { InstrumentationBase } from "@opentelemetry/instrumentation";
import { logs } from "@opentelemetry/api-logs";
import type { Do11yConfig, EmitFn } from "../core/types.js";
import { VERSION } from "../core/constants.js";
import { applyFrameworkSelectors } from "../core/presets.js";
import { getBrowserContext } from "../core/context.js";
import { getPageInfo } from "../core/context.js";
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
 * OpenTelemetry instrumentation for documentation sites.
 *
 * Emits log records for documentation-specific events (page views,
 * scroll depth, tab switches, code copies, etc.) through the
 * OpenTelemetry API. Works alongside @opentelemetry/browser-sdk
 * and other browser instrumentations.
 */
export class DocsInstrumentation extends InstrumentationBase<DocsInstrumentationConfig> {
  private _do11yConfig: Partial<Do11yConfig> = {};
  private _emit: EmitFn = () => {};
  private _mutationObserver: MutationObserver | null = null;
  private _pathPollId: ReturnType<typeof setInterval> | null = null;
  private _lastPath: string = "";
  private _boundHandlePathChange: (() => void) | null = null;
  private _boundPopstateHandler: (() => void) | null = null;

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

    // Create emit function backed by the OTel Logger, rate-limited to match
    // the standalone transport so rapid duplicate events don't spam the
    // collector while distinct scroll milestones still get through. The
    // limiter is created here (not as a class field) because the base class
    // constructor calls enable() before subclass field initializers run.
    const rateLimiter = createRateLimiter();
    const logger = logs.getLogger("@manototh/do11y");
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
      logger.emit({
        eventName,
        severityNumber: 9, // SEVERITY_NUMBER_INFO
        attributes: {
          "browser.do11y.version": VERSION,
          ...getBrowserContext(),
          ...getPageInfo(),
          ...eventData,
        },
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
