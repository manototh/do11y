/**
 * Do11y — Documentation Observability
 *
 * DocsInstrumentation configuration types.
 */
import type { InstrumentationConfig } from "@opentelemetry/instrumentation";
import type { Do11yConfig, FrameworkPreset } from "../core/types.js";
import { DEFAULT_RATE_LIMIT_MS } from "../core/rate-limit.js";

/**
 * Configuration options for DocsInstrumentation.
 * Extends InstrumentationConfig with do11y-specific settings.
 */
export interface DocsInstrumentationConfig extends InstrumentationConfig {
  /** Documentation framework preset. Default: 'mintlify' */
  framework?: FrameworkPreset;

  // Custom selectors override (only used when framework='custom')
  searchSelector?: string;
  copyButtonSelector?: string;
  codeBlockSelector?: string;
  navigationSelector?: string;
  footerSelector?: string;
  contentSelector?: string;
  tabContainerSelector?: string;
  tocSelector?: string;
  feedbackSelector?: string;

  // Tracking toggles — all default to true
  trackScrollDepth?: boolean;
  scrollThresholds?: number[];
  trackOutboundLinks?: boolean;
  trackInternalLinks?: boolean;
  trackSectionVisibility?: boolean;
  sectionVisibleThreshold?: number;
  trackTabSwitches?: boolean;
  trackTocClicks?: boolean;
  trackExpandCollapse?: boolean;
  trackFeedback?: boolean;
  trackSearch?: boolean;
  trackCopy?: boolean;
  /** SPA path-change detection (MutationObserver + popstate + poll). Default: false. */
  trackSpaPathChanges?: boolean;

  /** Emit do11y's own `session.id`/`session_page_count` attributes on each
   *  record. Set to false when using @opentelemetry/browser-sdk session
   *  processors, which attach `session.id` themselves. Default: true. */
  sessionAttributes?: boolean;

  /** Honor the visitor's Do Not Track preference. Default: true. */
  respectDNT?: boolean;

  /** Only track when the current host matches one of these domains (or a
   *  subdomain). `null` allows all domains. Default: null. */
  allowedDomains?: string[] | null;

  /** Debug logging */
  debug?: boolean;

  /** Minimum gap between events of the same type. Default: 100. */
  rateLimitMs?: number;
}

/**
 * Build a normalized Do11yConfig from the instrumentation's user config.
 * This bridges the gap between the simplified DocsInstrumentationConfig
 * and the full Do11yConfig used by the core tracking modules.
 */
export function buildConfig(userConfig: DocsInstrumentationConfig): Partial<Do11yConfig> {
  return {
    framework: userConfig.framework ?? "mintlify",
    debug: userConfig.debug ?? false,
    rateLimitMs: userConfig.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS,
    trackScrollDepth: userConfig.trackScrollDepth ?? true,
    scrollThresholds: userConfig.scrollThresholds ?? [25, 50, 75, 90],
    trackOutboundLinks: userConfig.trackOutboundLinks ?? true,
    trackInternalLinks: userConfig.trackInternalLinks ?? true,
    trackSectionVisibility: userConfig.trackSectionVisibility ?? true,
    sectionVisibleThreshold: userConfig.sectionVisibleThreshold ?? 3,
    trackSearch: userConfig.trackSearch ?? true,
    trackCopy: userConfig.trackCopy ?? true,
    trackTabSwitches: userConfig.trackTabSwitches ?? true,
    trackTocClicks: userConfig.trackTocClicks ?? true,
    trackExpandCollapse: userConfig.trackExpandCollapse ?? true,
    trackFeedback: userConfig.trackFeedback ?? true,
    trackSpaPathChanges: userConfig.trackSpaPathChanges ?? false,
    sessionAttributes: userConfig.sessionAttributes ?? true,
    // Privacy — same defaults as the standalone build.
    respectDNT: userConfig.respectDNT ?? true,
    allowedDomains: userConfig.allowedDomains ?? null,
    // Selector overrides from user config
    searchSelector: userConfig.searchSelector ?? null,
    copyButtonSelector: userConfig.copyButtonSelector ?? null,
    codeBlockSelector: userConfig.codeBlockSelector ?? null,
    navigationSelector: userConfig.navigationSelector ?? null,
    footerSelector: userConfig.footerSelector ?? null,
    contentSelector: userConfig.contentSelector ?? null,
    tabContainerSelector: userConfig.tabContainerSelector ?? null,
    tocSelector: userConfig.tocSelector ?? null,
    feedbackSelector: userConfig.feedbackSelector ?? null,
  } as Partial<Do11yConfig>;
}
