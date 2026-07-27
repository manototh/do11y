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
import { setupScrollTracking } from '../core/tracking/scroll.js';
import { setupEngagementTracking } from '../core/tracking/engagement.js';
import { setupSearchTracking } from '../core/tracking/search.js';
import { setupCopyTracking } from '../core/tracking/copy.js';
import {
  setupSectionVisibilityTracking,
  disconnectSectionObserver,
} from '../core/tracking/sections.js';
import { setupTabSwitchTracking } from '../core/tracking/tabs.js';
import { setupTocClickTracking } from '../core/tracking/toc.js';
import { setupFeedbackTracking } from '../core/tracking/feedback.js';
import { setupExpandCollapseTracking } from '../core/tracking/expand.js';
import type { DocsInstrumentationConfig } from './config.js';
import { buildConfig } from './config.js';

export type { DocsInstrumentationConfig } from './config.js';

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
  }

  /**
   * Disable the instrumentation: tear down all event listeners and observers.
   */
  override disable(): void {
    disconnectSectionObserver();
    this._do11yConfig = {};
  }
}
