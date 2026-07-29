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
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { logs } from '@opentelemetry/api-logs';
import type { Do11yConfig, EmitFn } from '../core/types.js';
import { VERSION } from '../core/constants.js';
import { applyFrameworkSelectors } from '../core/presets.js';
import { getBrowserContext } from '../core/context.js';
import { getPageInfo } from '../core/context.js';
import { trackPageView } from '../core/tracking/page-view.js';
import { setupLinkTracking } from '../core/tracking/links.js';
import { setupScrollTracking, checkScrollDepth, resetTrackedScrollDepths } from '../core/tracking/scroll.js';
import { setupEngagementTracking, emitPageExit, resetEngagementState } from '../core/tracking/engagement.js';
import { setupSearchTracking } from '../core/tracking/search.js';
import { setupCopyTracking } from '../core/tracking/copy.js';
import {
  setupSectionVisibilityTracking,
  disconnectSectionObserver,
  observeHeadings,
} from '../core/tracking/sections.js';
import { setupTabSwitchTracking } from '../core/tracking/tabs.js';
import { setupTocClickTracking } from '../core/tracking/toc.js';
import { setupFeedbackTracking } from '../core/tracking/feedback.js';
import { setupExpandCollapseTracking } from '../core/tracking/expand.js';
import type { DocsInstrumentationConfig } from './config.js';
import { buildConfig } from './config.js';

export type { DocsInstrumentationConfig } from './config.js';

// ─── SPA navigation detection state ────────────────────────────────────────

let mutationObserver: MutationObserver | null = null;
let pathPollId: ReturnType<typeof setInterval> | null = null;
let popstateHandler: ((this: WindowEventHandlers, ev: PopStateEvent) => void) | null = null;

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

  constructor(config: DocsInstrumentationConfig = {}) {
    super('@manototh/do11y', VERSION, config);
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

    // Create emit function backed by the OTel Logger
    const logger = logs.getLogger('@manototh/do11y');
    const emit: EmitFn = (eventName, eventData) => {
      logger.emit({
        eventName,
        severityNumber: 9, // SEVERITY_NUMBER_INFO
        attributes: {
          'browser.do11y.version': VERSION,
          ...getBrowserContext(),
          ...getPageInfo(),
          ...eventData,
        },
        body: '',
      });
    };

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

    // ── SPA navigation detection ────────────────────────────────────────
    // Detects client-side route changes and emits page_exit + page_view so
    // that each virtual page in a SPA is tracked independently.

    let lastPath = window.location.pathname;

    const handlePathChange = (): void => {
      if (window.location.pathname === lastPath) return;
      lastPath = window.location.pathname;
      emitPageExit(this._do11yConfig as Do11yConfig, emit);
      resetTrackedScrollDepths();
      resetEngagementState();
      trackPageView(this._do11yConfig as Do11yConfig, emit);
      observeHeadings();
      checkScrollDepth(this._do11yConfig as Do11yConfig, emit);
    };

    mutationObserver = new MutationObserver(handlePathChange);
    // document.body may be null if the page hasn't loaded yet (e.g. during
    // evaluateOnNewDocument bootstrap). When body exists, observe it directly;
    // otherwise, the 200ms path poll catches path changes until body arrives.
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      // Re-check periodically until body is available, then start observing.
      const bodyCheckId = window.setInterval(() => {
        if (document.body) {
          mutationObserver!.observe(document.body, { childList: true, subtree: true });
          clearInterval(bodyCheckId);
        }
      }, 100);
    }

    popstateHandler = handlePathChange;
    window.addEventListener('popstate', popstateHandler!);

    // Supplementary pathname poll: some SPA routers (e.g. Mintlify) update
    // the DOM before calling history.pushState, causing the MutationObserver
    // to fire before the pathname changes. A lightweight interval catches
    // these missed transitions.
    pathPollId = window.setInterval(handlePathChange, 200);
  }

  /**
   * Disable the instrumentation: tear down all event listeners and observers.
   */
  override disable(): void {
    disconnectSectionObserver();

    // Tear down SPA navigation detection
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (pathPollId !== null) {
      clearInterval(pathPollId);
      pathPollId = null;
    }
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }

    this._do11yConfig = {};
  }
}
