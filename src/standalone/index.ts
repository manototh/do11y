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
import type { Do11yConfig } from "../core/types.js";
import { VERSION } from "../core/constants.js";
import { applyFrameworkSelectors } from "../core/presets.js";
import { shouldDisableTracking } from "../core/privacy.js";
import { trackPageView } from "../core/tracking/page-view.js";
import { setupLinkTracking } from "../core/tracking/links.js";
import {
  setupScrollTracking,
  checkScrollDepth,
  resetTrackedScrollDepths,
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
  observeHeadings,
  disconnectSectionObserver,
} from "../core/tracking/sections.js";
import { setupTabSwitchTracking } from "../core/tracking/tabs.js";
import { setupTocClickTracking } from "../core/tracking/toc.js";
import { setupFeedbackTracking } from "../core/tracking/feedback.js";
import { setupExpandCollapseTracking } from "../core/tracking/expand.js";
import {
  queueEvent,
  flush,
  flushSync,
  cleanup as transportCleanup,
  setIsDisabled,
  getIsDisabled,
  getQueueLength,
} from "./transport.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const config: Do11yConfig = {
  destination: "supabase",
  supabaseUrl: "",
  supabaseKey: "",
  supabaseTable: "do11y_events",
  endpoint: "",
  headers: {},
  bodyTransform: undefined,
  otelSdkEndpoint: "",
  otelSdkHeaders: {},
  otelSdkServiceName: "do11y",
  otelSdkResourceAttributes: {},
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
  framework: "mintlify",
  trackSectionVisibility: true,
  sectionVisibleThreshold: 3,
  trackSearch: true,
  trackCopy: true,
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
  trackSpaPathChanges: false,
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
let pathPollId: ReturnType<typeof setInterval> | null = null;

function init(): void {
  // Read from window.Do11yConfig
  // Assign only known Do11yConfig keys from the user-supplied config.
  // Both configs are typed objects; the intermediate Record cast is
  // needed because Partial<Do11yConfig> values may be a different
  // type than Do11yConfig expects (e.g. undefined vs boolean).
  const cfg = config as unknown as Record<string, unknown>;
  const userCfg = window.Do11yConfig as unknown as Record<string, unknown>;
  if (userCfg && typeof userCfg === "object") {
    for (const key in config) {
      if (Object.prototype.hasOwnProperty.call(userCfg, key)) {
        const val = userCfg[key];
        if (val !== undefined) cfg[key] = val;
      }
    }
  }

  // Read from meta tags
  const metaDestination = document.querySelector('meta[name="do11y-destination"]');
  if (metaDestination) {
    const dest = metaDestination.getAttribute("content");
    if (dest === "supabase" || dest === "http" || dest === "otlp") config.destination = dest;
  }

  const metaUrl = document.querySelector('meta[name="do11y-url"]');
  if (metaUrl) config.supabaseUrl = metaUrl.getAttribute("content") ?? config.supabaseUrl;

  const metaKey = document.querySelector('meta[name="do11y-key"]');
  if (metaKey) config.supabaseKey = metaKey.getAttribute("content") ?? config.supabaseKey;

  const metaTable = document.querySelector('meta[name="do11y-table"]');
  if (metaTable) config.supabaseTable = metaTable.getAttribute("content") ?? config.supabaseTable;

  const metaEndpoint = document.querySelector('meta[name="do11y-endpoint"]');
  if (metaEndpoint) config.endpoint = metaEndpoint.getAttribute("content") ?? config.endpoint;

  const metaOtlpEndpoint = document.querySelector('meta[name="do11y-otlp-endpoint"]');
  if (metaOtlpEndpoint)
    config.otelSdkEndpoint = metaOtlpEndpoint.getAttribute("content") ?? config.otelSdkEndpoint;

  const metaOtlpHeaders = document.querySelector('meta[name="do11y-otlp-headers"]');
  if (metaOtlpHeaders) {
    try {
      const parsed = JSON.parse(metaOtlpHeaders.getAttribute("content") ?? "{}");
      if (typeof parsed === "object" && parsed !== null) {
        config.otelSdkHeaders = parsed;
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const metaDebug = document.querySelector('meta[name="do11y-debug"]');
  if (metaDebug && metaDebug.getAttribute("content") === "true") config.debug = true;

  const metaDomains = document.querySelector('meta[name="do11y-domains"]');
  if (metaDomains) {
    const domainsStr = metaDomains.getAttribute("content");
    if (domainsStr) {
      config.allowedDomains = domainsStr.split(",").map((d) => d.trim());
    }
  }

  const metaFramework = document.querySelector('meta[name="do11y-framework"]');
  if (metaFramework) {
    const rawFramework = metaFramework.getAttribute("content");
    const validFrameworks: readonly string[] = [
      "mintlify",
      "docusaurus",
      "nextra",
      "mkdocs-material",
      "vitepress",
      "starlight",
      "docsy",
      "custom",
    ];
    if (rawFramework && validFrameworks.includes(rawFramework)) {
      config.framework = rawFramework as import("../core/types.js").FrameworkPreset;
    } else if (rawFramework && config.debug) {
      console.warn(
        '[Do11y] Unknown framework in meta tag: "' +
          rawFramework +
          '". Using default: ' +
          config.framework,
      );
    }
  }

  const metaUseOtelInstrumentations = document.querySelector(
    'meta[name="do11y-use-otel-instrumentations"]',
  );
  if (
    metaUseOtelInstrumentations &&
    metaUseOtelInstrumentations.getAttribute("content") === "true"
  ) {
    config.useOtelBrowserInstrumentations = true;
  }

  applyFrameworkSelectors(config);

  if (config.debug) {
    console.log("[Do11y] Initializing with config:", {
      destination: config.destination,
      framework: config.framework,
      allowedDomains: config.allowedDomains,
      respectDNT: config.respectDNT,
    });
  }

  if (shouldDisableTracking(config)) {
    setIsDisabled(true);
    if (config.debug) console.log("[Do11y] Tracking disabled");
    return;
  }

  const hasDestination =
    config.destination === "supabase"
      ? !!config.supabaseKey
      : config.destination === "otlp"
        ? !!config.otelSdkEndpoint
        : !!config.endpoint;
  if (!hasDestination) {
    console.warn("[Do11y] No destination configured. Events will not be sent.");
    if (config.destination === "supabase") {
      console.warn('[Do11y] Add <meta name="do11y-url"> and <meta name="do11y-key"> to enable.');
    } else if (config.destination === "otlp") {
      console.warn('[Do11y] Add <meta name="do11y-otlp-endpoint"> to enable.');
    } else {
      console.warn('[Do11y] Add <meta name="do11y-endpoint"> to enable.');
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

  const handlePathChange = (): void => {
    if (window.location.pathname === lastPath) return;
    lastPath = window.location.pathname;
    emitPageExit(config, emit, () => flush(config));
    resetTrackedScrollDepths();
    resetEngagementState();
    trackPageView(config, emit);
    observeHeadings();
    checkScrollDepth(config, emit);
  };

  mutationObserver = new MutationObserver(handlePathChange);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("popstate", handlePathChange);

  // Supplementary pathname poll: some SPA routers (e.g. Mintlify) update
  // the DOM before calling history.pushState, causing the MutationObserver
  // to fire before the pathname changes. A lightweight interval catches
  // these missed transitions.
  pathPollId = window.setInterval(handlePathChange, 200);

  // Freeze the resolved config so that third-party scripts loaded after
  // this point cannot mutate host, key, or any other field
  // through window.Do11yConfig or direct property assignment.
  Object.freeze(config);

  // Standalone beforeunload handler: flush remaining events on page unload.
  // The page_exit event is already emitted by setupEngagementTracking's
  // beforeunload listener (registered above), so we only flush the transport.
  // The pageExited guard in emitPageExit prevents double emission.
  window.addEventListener("beforeunload", () => {
    if (pathPollId !== null) {
      clearInterval(pathPollId);
      pathPollId = null;
    }
    flushSync(config);
    transportCleanup();
  });

  // Pause the SPA path poll when the tab is hidden (no need to check
  // for path changes when the user can't see the page).
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && pathPollId !== null) {
      clearInterval(pathPollId);
      pathPollId = null;
    } else if (!document.hidden && pathPollId === null && config.trackSpaPathChanges) {
      pathPollId = window.setInterval(handlePathChange, 200);
    }
  });

  if (config.debug) console.log("[Do11y] Initialized successfully");
}

/** Tear down all tracking: remove listeners, disconnect observers, flush queue. */
export function destroy(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (pathPollId !== null) {
    clearInterval(pathPollId);
    pathPollId = null;
  }
  // disconnectSectionObserver cleans up the IntersectionObserver and pending timers
  disconnectSectionObserver();
  // Flush any remaining events synchronously
  flushSync(config);
  transportCleanup();
  setIsDisabled(true);
  window.__do11yInitialized = false;
}

// ─── Auto-bootstrap ──────────────────────────────────────────────────────────

if (!_alreadyLoaded && !_isInIframe) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

window.Do11y = window.Do11y ?? {
  getConfig: () => ({
    destination: config.destination,
    hasCredentials:
      config.destination === "supabase"
        ? !!config.supabaseKey
        : config.destination === "otlp"
          ? !!config.otelSdkEndpoint
          : !!config.endpoint,
    isDisabled: getIsDisabled(),
    allowedDomains: config.allowedDomains,
    respectDNT: config.respectDNT,
  }),
  flush: () => flush(config),
  isEnabled: () => {
    if (getIsDisabled()) return false;
    if (config.destination === "supabase") return !!config.supabaseKey;
    if (config.destination === "otlp") return !!config.otelSdkEndpoint;
    return !!config.endpoint;
  },
  getQueueSize: () => getQueueLength(),
  version: VERSION,
  destroy: () => destroy(),
};
