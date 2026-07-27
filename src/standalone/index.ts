/**
 * Do11y — Documentation Observability
 *
 * Standalone IIFE entry point.
 *
 * This is the script-tag distribution. It reads config from
 * window.Do11yConfig and meta tags, then wires up all tracking
 * through the standalone transport layer (event queue + batching).
 *
 * Behaviour is identical to the pre-refactor src/do11y.ts.
 */
import type { Do11yConfig } from '../core/types.js';
import { VERSION } from '../core/constants.js';
import { applyFrameworkSelectors } from '../core/presets.js';
import { shouldDisableTracking } from '../core/privacy.js';
import { trackPageView } from '../core/tracking/page-view.js';
import { setupLinkTracking } from '../core/tracking/links.js';
import { setupScrollTracking, checkScrollDepth, resetTrackedScrollDepths } from '../core/tracking/scroll.js';
import {
  setupEngagementTracking,
  emitPageExit,
  resetEngagementState,
} from '../core/tracking/engagement.js';
import { setupSearchTracking } from '../core/tracking/search.js';
import { setupCopyTracking } from '../core/tracking/copy.js';
import {
  setupSectionVisibilityTracking,
  observeHeadings,
} from '../core/tracking/sections.js';
import { setupTabSwitchTracking } from '../core/tracking/tabs.js';
import { setupTocClickTracking } from '../core/tracking/toc.js';
import { setupFeedbackTracking } from '../core/tracking/feedback.js';
import { setupExpandCollapseTracking } from '../core/tracking/expand.js';
import {
  queueEvent,
  flush,
  flushSync,
  cleanup as transportCleanup,
  setIsDisabled,
  getIsDisabled,
  getQueueLength,
} from './transport.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const config: Do11yConfig = {
  destination: 'supabase',
  supabaseUrl: '',
  supabaseKey: '',
  supabaseTable: 'do11y_events',
  endpoint: '',
  headers: {},
  bodyTransform: undefined,
  otelSdkEndpoint: '',
  otelSdkHeaders: {},
  otelSdkServiceName: 'do11y',
  otelSdkResourceAttributes: {},
  otelSdkCdnUrl: 'https://esm.sh/',
  debug: false,
  flushInterval: 5000,
  maxBatchSize: 10,
  trackOutboundLinks: true,
  trackInternalLinks: true,
  trackScrollDepth: true,
  scrollThresholds: [25, 50, 75, 90],
  allowedDomains: null,
  respectDNT: true,
  maxRetries: 2,
  retryDelay: 1000,
  rateLimitMs: 100,
  framework: 'mintlify',
  trackSectionVisibility: true,
  sectionVisibleThreshold: 3,
  trackTabSwitches: true,
  trackTocClicks: true,
  trackExpandCollapse: true,
  trackFeedback: true,
  tabContainerSelector: null,
  tocSelector: null,
  feedbackSelector: null,
  searchSelector: null,
  copyButtonSelector: null,
  codeBlockSelector: null,
  navigationSelector: null,
  footerSelector: null,
  contentSelector: null,
  useOtelBrowserInstrumentations: false,
};

// ─── Guard: prevent double-init ──────────────────────────────────────────────

const _alreadyLoaded = !!window.__do11yInitialized;
window.__do11yInitialized = true;

const _isInIframe = window.self !== window.top;
if (_isInIframe && !_alreadyLoaded) {
  window.__do11yInitialized = false; // allow re-init if this frame becomes top
}

// ─── Init ────────────────────────────────────────────────────────────────────

let mutationObserver: MutationObserver | null = null;

function init(): void {
  // Read from window.Do11yConfig
  if (window.Do11yConfig && typeof window.Do11yConfig === 'object') {
    for (const key in window.Do11yConfig) {
      if (
        Object.prototype.hasOwnProperty.call(window.Do11yConfig, key) &&
        Object.prototype.hasOwnProperty.call(config, key)
      ) {
        (config as unknown as Record<string, unknown>)[key] = (window.Do11yConfig as unknown as Record<string, unknown>)[key];
      }
    }
  }

  // Read from meta tags
  const metaDestination = document.querySelector('meta[name="do11y-destination"]');
  if (metaDestination) {
    const dest = metaDestination.getAttribute('content');
    if (dest === 'supabase' || dest === 'http' || dest === 'otlp') config.destination = dest;
  }

  const metaUrl = document.querySelector('meta[name="do11y-url"]');
  if (metaUrl) config.supabaseUrl = metaUrl.getAttribute('content') ?? config.supabaseUrl;

  const metaKey = document.querySelector('meta[name="do11y-key"]');
  if (metaKey) config.supabaseKey = metaKey.getAttribute('content') ?? config.supabaseKey;

  const metaTable = document.querySelector('meta[name="do11y-table"]');
  if (metaTable) config.supabaseTable = metaTable.getAttribute('content') ?? config.supabaseTable;

  const metaEndpoint = document.querySelector('meta[name="do11y-endpoint"]');
  if (metaEndpoint) config.endpoint = metaEndpoint.getAttribute('content') ?? config.endpoint;

  const metaOtlpEndpoint = document.querySelector('meta[name="do11y-otlp-endpoint"]');
  if (metaOtlpEndpoint) config.otelSdkEndpoint = metaOtlpEndpoint.getAttribute('content') ?? config.otelSdkEndpoint;

  const metaOtlpHeaders = document.querySelector('meta[name="do11y-otlp-headers"]');
  if (metaOtlpHeaders) {
    try {
      const parsed = JSON.parse(metaOtlpHeaders.getAttribute('content') ?? '{}');
      if (typeof parsed === 'object' && parsed !== null) {
        config.otelSdkHeaders = parsed;
      }
    } catch { /* ignore invalid JSON */ }
  }

  const metaDebug = document.querySelector('meta[name="do11y-debug"]');
  if (metaDebug && metaDebug.getAttribute('content') === 'true') config.debug = true;

  const metaDomains = document.querySelector('meta[name="do11y-domains"]');
  if (metaDomains) {
    const domainsStr = metaDomains.getAttribute('content');
    if (domainsStr) {
      config.allowedDomains = domainsStr.split(',').map((d) => d.trim());
    }
  }

  const metaFramework = document.querySelector('meta[name="do11y-framework"]');
  if (metaFramework) {
    config.framework = (metaFramework.getAttribute('content') ?? config.framework) as import('../core/types.js').FrameworkPreset;
  }

  const metaUseOtelInstrumentations = document.querySelector('meta[name="do11y-use-otel-instrumentations"]');
  if (metaUseOtelInstrumentations && metaUseOtelInstrumentations.getAttribute('content') === 'true') {
    config.useOtelBrowserInstrumentations = true;
  }

  applyFrameworkSelectors(config);

  if (config.debug) {
    const hasCreds =
      config.destination === 'supabase' ? !!config.supabaseKey :
      config.destination === 'otlp' ? !!config.otelSdkEndpoint :
      !!config.endpoint;
    console.log('[Do11y] Initializing with config:', {
      destination: config.destination,
      hasCredentials: hasCreds,
      framework: config.framework,
      allowedDomains: config.allowedDomains,
      respectDNT: config.respectDNT,
    });
  }

  if (shouldDisableTracking(config)) {
    setIsDisabled(true);
    if (config.debug) console.log('[Do11y] Tracking disabled');
    return;
  }

  const hasDestination =
    config.destination === 'supabase' ? !!config.supabaseKey :
    config.destination === 'otlp' ? !!config.otelSdkEndpoint :
    !!config.endpoint;
  if (!hasDestination) {
    if (config.debug) {
      console.warn('[Do11y] No destination configured. Events will not be sent.');
      if (config.destination === 'supabase') {
        console.warn('[Do11y] Add <meta name="do11y-url"> and <meta name="do11y-key"> to enable.');
      } else if (config.destination === 'otlp') {
        console.warn('[Do11y] Add <meta name="do11y-otlp-endpoint"> to enable.');
      } else {
        console.warn('[Do11y] Add <meta name="do11y-endpoint"> to enable.');
      }
    }
  }

  // Create emit function backed by standalone queue+transport
  const emit = (eventName: string, eventData: Record<string, unknown>) => {
    queueEvent(config, eventName, eventData);
  };

  // Wire up all tracking
  trackPageView(config, emit);
  setupLinkTracking(config, emit);
  setupScrollTracking(config, emit);
  setupEngagementTracking(config, emit);
  setupSearchTracking(config, emit);
  setupCopyTracking(config, emit);
  setupSectionVisibilityTracking(config, emit);
  setupTabSwitchTracking(config, emit);
  setupTocClickTracking(config, emit);
  setupFeedbackTracking(config, emit);
  setupExpandCollapseTracking(config, emit);

  let lastPath = window.location.pathname;

  mutationObserver = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      emitPageExit(config, emit);
      resetTrackedScrollDepths();
      resetEngagementState();
      trackPageView(config, emit);
      observeHeadings();
      checkScrollDepth(config, emit);
    }
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      emitPageExit(config, emit);
      resetTrackedScrollDepths();
      resetEngagementState();
      trackPageView(config, emit);
      observeHeadings();
      checkScrollDepth(config, emit);
    }
  });

  // Freeze the resolved config so that third-party scripts loaded after
  // this point cannot mutate host, key, or any other field
  // through window.Do11yConfig or direct property assignment.
  Object.freeze(config);

  // Add standalone-specific beforeunload handler to flush remaining events
  window.addEventListener('beforeunload', () => {
    transportCleanup();
    flushSync(config);
  });

  if (config.debug) console.log('[Do11y] Initialized successfully');
}

// ─── Auto-bootstrap ──────────────────────────────────────────────────────────

if (!_alreadyLoaded && !_isInIframe) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

window.Do11y = window.Do11y ?? {
  getConfig: () => ({
    destination: config.destination,
    hasCredentials:
      config.destination === 'supabase' ? !!config.supabaseKey :
      config.destination === 'otlp' ? !!config.otelSdkEndpoint :
      !!config.endpoint,
    isDisabled: getIsDisabled(),
    allowedDomains: config.allowedDomains,
    respectDNT: config.respectDNT,
  }),
  flush: () => flush(config),
  isEnabled: () => {
    if (getIsDisabled()) return false;
    if (config.destination === 'supabase') return !!config.supabaseKey;
    if (config.destination === 'otlp') return !!config.otelSdkEndpoint;
    return !!config.endpoint;
  },
  getQueueSize: () => getQueueLength(),
  version: VERSION,
};
