// Originally derived from https://github.com/axiomhq/do11y
/**
 * Do11y — Documentation Observability
 *
 * Framework-agnostic documentation observability. Works with any static-site
 * generator or docs framework including Mintlify, Docusaurus, Nextra,
 * MkDocs Material, VitePress, Starlight (Astro), and plain HTML.
 *
 * Set the `framework` config option to your docs framework. Supported
 * values: 'mintlify', 'docusaurus', 'nextra', 'mkdocs-material',
 * 'vitepress', 'starlight'. Set to 'custom' and provide your own selectors
 * if your framework is not listed.
 *
 * This script collects anonymous usage data without:
 * - Cookies (uses sessionStorage only - cleared when browser closes)
 * - Personal identifiable information (PII)
 * - Device fingerprinting
 * - Cross-site tracking
 *
 * No GDPR consent banner required.
 *
 * Configuration (in order of precedence):
 * 1. HTML <meta> tags:
 *    <meta name="do11y-destination" content="supabase">
 *    <meta name="do11y-url" content="https://YOUR_PROJECT.supabase.co">
 *    <meta name="do11y-key" content="sb_publishable_...">
 *    <meta name="do11y-framework" content="mintlify">
 *    <meta name="do11y-endpoint" content="https://your-collector.example.com">
 *    <meta name="do11y-otlp-endpoint" content="https://otlp.grafana.com/otlp">
 * 2. window.Do11yConfig object (set in a separate script before this file):
 *    window.Do11yConfig = { supabaseUrl: '...', supabaseKey: 'sb_publishable_...', framework: 'mintlify' };
 * 3. The config object below (defaults).
 *
 * Using meta tags or window.Do11yConfig is recommended so you can
 * update do11y.js without losing your settings.
 *
 * All events use OpenTelemetry semantic convention attribute naming
 * (https://opentelemetry.io/docs/specs/semconv/).
 * Event names follow the `browser.do11y.*` namespace.
 */

// ============================================================
// Types
// ============================================================

export type FrameworkPreset =
  | 'mintlify'
  | 'docusaurus'
  | 'nextra'
  | 'mkdocs-material'
  | 'vitepress'
  | 'starlight'
  | 'custom';

export interface FrameworkSelectors {
  searchSelector: string;
  copyButtonSelector: string;
  codeBlockSelector: string;
  navigationSelector: string;
  footerSelector: string;
  contentSelector: string;
  tabContainerSelector: string;
  tocSelector: string;
  feedbackSelector: string;
}

export type Destination = 'supabase' | 'http' | 'otlp';

export interface Do11yConfig {
  destination: Destination;
  // Supabase preset (used when destination is 'supabase')
  supabaseUrl: string;
  supabaseKey: string;
  supabaseTable: string;
  // Generic HTTP destination
  endpoint: string;
  headers: Record<string, string>;
  /** Transform the event array before sending as JSON body.
   *  Default: identity (sends [`event`, ...]).
   *  Supabase preset: events => events.map(e => ({ payload: e })). */
  bodyTransform?: (events: object[]) => object;
  // OTel Browser SDK destination (used when destination is 'otlp')
  otelSdkEndpoint: string;
  otelSdkHeaders: Record<string, string>;
  otelSdkServiceName: string;
  otelSdkResourceAttributes: Record<string, string>;
  otelSdkCdnUrl: string;
  // Behavior
  debug: boolean;
  flushInterval: number;
  maxBatchSize: number;
  trackOutboundLinks: boolean;
  trackInternalLinks: boolean;
  trackScrollDepth: boolean;
  scrollThresholds: number[];
  allowedDomains: string[] | null;
  respectDNT: boolean;
  maxRetries: number;
  retryDelay: number;
  rateLimitMs: number;
  framework: FrameworkPreset;
  trackSectionVisibility: boolean;
  sectionVisibleThreshold: number;
  trackTabSwitches: boolean;
  trackTocClicks: boolean;
  trackExpandCollapse: boolean;
  trackFeedback: boolean;
  tabContainerSelector: string | null;
  tocSelector: string | null;
  feedbackSelector: string | null;
  searchSelector: string | null;
  copyButtonSelector: string | null;
  codeBlockSelector: string | null;
  navigationSelector: string | null;
  footerSelector: string | null;
  contentSelector: string | null;
  useOtelBrowserInstrumentations: boolean;
}

/**
 * OTel semantic convention attribute keys.
 * Standard attrs from https://opentelemetry.io/docs/specs/semconv/.
 * Custom do11y attrs use the `browser.do11y.*` namespace.
 */
const ATTR_SESSION_ID = 'session.id';
const ATTR_URL_PATH = 'url.path';
const ATTR_URL_FRAGMENT = 'url.fragment';
const ATTR_URL_QUERY = 'url.query';
const ATTR_DEVICE_TYPE = 'device.type';
const ATTR_BROWSER_FAMILY = 'browser.family';
const ATTR_BROWSER_LANGUAGE = 'browser.language';

const ATTR_DO11Y_SESSION_PAGE_COUNT = 'browser.do11y.session_page_count';
const ATTR_DO11Y_PAGE_TITLE = 'browser.do11y.page_title';
const ATTR_DO11Y_VIEWPORT_CATEGORY = 'browser.do11y.viewport_category';
const ATTR_DO11Y_TIMEZONE_OFFSET = 'browser.do11y.timezone_offset';
const ATTR_DO11Y_REFERRER_CATEGORY = 'browser.do11y.referrer_category';
const ATTR_DO11Y_AI_PLATFORM = 'browser.do11y.ai_platform';
const ATTR_DO11Y_DO11Y_VERSION = 'browser.do11y.version';
const ATTR_DO11Y_IS_FIRST_PAGE = 'browser.do11y.is_first_page';
const ATTR_DO11Y_PREVIOUS_PATH = 'browser.do11y.previous_path';
const ATTR_DO11Y_REFERRER_DOMAIN = 'browser.do11y.referrer_domain';
const ATTR_DO11Y_LINK_TYPE = 'browser.do11y.link.type';
const ATTR_DO11Y_LINK_TARGET_URL = 'browser.do11y.link.target_url';
const ATTR_DO11Y_LINK_TARGET_DOMAIN = 'browser.do11y.link.target_domain';
const ATTR_DO11Y_LINK_TEXT = 'browser.do11y.link.text';
const ATTR_DO11Y_LINK_CONTEXT = 'browser.do11y.link.context';
const ATTR_DO11Y_LINK_SECTION = 'browser.do11y.link.section';
const ATTR_DO11Y_LINK_INDEX = 'browser.do11y.link.index';
const ATTR_DO11Y_SCROLL_THRESHOLD = 'browser.do11y.scroll.threshold';
const ATTR_DO11Y_SCROLL_PERCENT = 'browser.do11y.scroll.percent';
const ATTR_DO11Y_TOTAL_TIME_SECONDS = 'browser.do11y.page_exit.total_time_seconds';
const ATTR_DO11Y_ACTIVE_TIME_SECONDS = 'browser.do11y.page_exit.active_time_seconds';
const ATTR_DO11Y_ENGAGEMENT_RATIO = 'browser.do11y.page_exit.engagement_ratio';
const ATTR_DO11Y_MAX_SCROLL_DEPTH = 'browser.do11y.page_exit.max_scroll_depth';
const ATTR_DO11Y_SEARCH_TRIGGER = 'browser.do11y.search.trigger';
const ATTR_DO11Y_CODE_LANGUAGE = 'browser.do11y.code.language';
const ATTR_DO11Y_CODE_SECTION = 'browser.do11y.code.section';
const ATTR_DO11Y_CODE_INDEX = 'browser.do11y.code.index';
const ATTR_DO11Y_SECTION_HEADING = 'browser.do11y.section.heading';
const ATTR_DO11Y_SECTION_HEADING_LEVEL = 'browser.do11y.section.heading_level';
const ATTR_DO11Y_SECTION_VISIBLE_SECONDS = 'browser.do11y.section.visible_seconds';
const ATTR_DO11Y_TAB_LABEL = 'browser.do11y.tab.label';
const ATTR_DO11Y_TAB_GROUP = 'browser.do11y.tab.group';
const ATTR_DO11Y_TAB_IS_DEFAULT = 'browser.do11y.tab.is_default';
const ATTR_DO11Y_TOC_HEADING = 'browser.do11y.toc.heading';
const ATTR_DO11Y_TOC_HEADING_LEVEL = 'browser.do11y.toc.heading_level';
const ATTR_DO11Y_TOC_POSITION = 'browser.do11y.toc.position';
const ATTR_DO11Y_FEEDBACK_RATING = 'browser.do11y.feedback.rating';
const ATTR_DO11Y_EXPAND_SUMMARY = 'browser.do11y.expand.summary';
const ATTR_DO11Y_EXPAND_ACTION = 'browser.do11y.expand.action';
const ATTR_DO11Y_EXPAND_SECTION = 'browser.do11y.expand.section';

/**
 * OTel event names for do11y events (browser.do11y.* namespace).
 */
const EVENT_PAGE_VIEW = 'browser.do11y.page_view';
const EVENT_PAGE_EXIT = 'browser.do11y.page_exit';
const EVENT_SCROLL_DEPTH = 'browser.do11y.scroll_depth';
const EVENT_LINK_CLICK = 'browser.do11y.link_click';
const EVENT_SEARCH_OPENED = 'browser.do11y.search_opened';
const EVENT_CODE_COPIED = 'browser.do11y.code_copied';
const EVENT_SECTION_VISIBLE = 'browser.do11y.section_visible';
const EVENT_TAB_SWITCH = 'browser.do11y.tab_switch';
const EVENT_TOC_CLICK = 'browser.do11y.toc_click';
const EVENT_FEEDBACK = 'browser.do11y.feedback';
const EVENT_EXPAND_COLLAPSE = 'browser.do11y.expand_collapse';

export interface Do11yEvent {
  _time: string;
  eventName: string;
  'session.id': string;
  'browser.do11y.session_page_count': number;
  'url.path': string;
  'url.fragment': string | null;
  'url.query': string | null;
  'browser.do11y.page_title': string | null;
  'browser.do11y.viewport_category': string;
  'browser.family': string;
  'device.type': string;
  'browser.language': string;
  'browser.do11y.timezone_offset': number;
  [key: string]: unknown;
}

interface Do11yAPI {
  getConfig: () => object;
  flush: () => void;
  isEnabled: () => boolean;
  getQueueSize: () => number;
  version: string;
}

declare global {
  interface Window {
    __do11yInitialized?: boolean;
    Do11yConfig?: Partial<Do11yConfig>;
    Do11y?: Do11yAPI;
    doNotTrack?: string;
  }
}

const VERSION = '0.1.0';

// Prevent double-initialization in SPA frameworks (React strict mode,
// Next.js/Nextra re-renders, etc.) where the script tag may be re-evaluated.
const _alreadyLoaded = !!window.__do11yInitialized;
window.__do11yInitialized = true;

// ============================================================
// Configuration
// ============================================================
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

// ============================================================
// Framework Selector Presets
// ============================================================

const FRAMEWORK_PRESETS: Record<string, FrameworkSelectors> = {
  mintlify: {
    searchSelector: '#search-bar-entry, #search-bar-entry-mobile, [class*="search"]',
    copyButtonSelector: 'button[class*="copy"], button[aria-label*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], #navbar, #sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '#table-of-contents, [data-testid="table-of-contents"], [class*="table-of-contents"], [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  docusaurus: {
    searchSelector: '.DocSearch, .DocSearch-Button',
    copyButtonSelector: 'button.clean-btn[aria-label*="copy" i], button[class*="copyButton"]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .navbar, .sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '.tabs[role="tablist"], [class*="tabs"]',
    tocSelector: '.table-of-contents, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  nextra: {
    searchSelector: '.nextra-search input, input[placeholder*="search" i], button[aria-label*="search" i]',
    copyButtonSelector: 'button[class*="copy"], button[aria-label*="copy" i], button[title*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '.nextra-toc, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  'mkdocs-material': {
    searchSelector: '.md-search__input',
    copyButtonSelector: '.md-clipboard, .md-code__button[title="Copy to clipboard"]',
    codeBlockSelector: 'pre, code, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .md-nav, .md-sidebar',
    footerSelector: 'footer, [role="contentinfo"], .md-footer',
    contentSelector: 'main, article, [role="main"], .md-content',
    tabContainerSelector: '.tabbed-labels, .md-typeset .tabbed-set',
    tocSelector: '.md-sidebar--secondary .md-nav, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  vitepress: {
    searchSelector: '.VPNavBarSearch button, .VPNavBarSearchButton, #local-search',
    copyButtonSelector: 'button.copy, .vp-code-copy, button.copy[title*="Copy"]',
    codeBlockSelector: 'div[class*="language-"], pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .VPNav, .VPSidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], .VPFooter, [class*="footer"]',
    contentSelector: 'main, article, [role="main"], .VPContent, [class*="content"]',
    tabContainerSelector: '.vp-code-group .tabs, [role="tablist"]',
    tocSelector: '.VPDocAsideOutline, .VPLocalNavOutlineDropdown, a.outline-link',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  starlight: {
    searchSelector: 'site-search button[data-open-modal], sl-doc-search .DocSearch-Button, button[aria-label*="search" i]',
    copyButtonSelector: '.expressive-code .copy button, .copy button[data-code]',
    codeBlockSelector: '.expressive-code pre, pre',
    navigationSelector: 'nav, [role="navigation"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, .sl-markdown-content, [role="main"]',
    tabContainerSelector: 'starlight-tabs [role="tablist"], [role="tablist"]',
    tocSelector: '.right-sidebar-panel, starlight-toc, mobile-starlight-toc',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
};

const SELECTOR_KEYS: ReadonlyArray<keyof FrameworkSelectors> = [
  'searchSelector',
  'copyButtonSelector',
  'codeBlockSelector',
  'navigationSelector',
  'footerSelector',
  'contentSelector',
  'tabContainerSelector',
  'tocSelector',
  'feedbackSelector',
];

/**
 * Apply framework-specific selectors to the config.
 * For 'custom', uses whatever the user set in config; for named
 * frameworks, loads the preset and lets explicit config values override.
 */
function applyFrameworkSelectors(): void {
  const preset = FRAMEWORK_PRESETS[config.framework];

  if (preset) {
    SELECTOR_KEYS.forEach((key) => {
      if (!config[key]) config[key] = preset[key];
    });
  } else if (config.framework !== 'custom') {
    if (config.debug) {
      console.warn(
        `[Do11y] Unknown framework "${config.framework}". ` +
        'Falling back to generic selectors. Supported: ' +
        Object.keys(FRAMEWORK_PRESETS).join(', ') + ', custom'
      );
    }
  }

  // Fallback for any selector still unset (covers 'custom' with partial overrides)
  const fallback = FRAMEWORK_PRESETS.mintlify;
  if (!fallback) return;
  SELECTOR_KEYS.forEach((key) => {
    if (!config[key]) config[key] = fallback[key];
  });
}

// ============================================================
// Security & Privacy Checks
// ============================================================

function shouldDisableTracking(): boolean {
  if (config.respectDNT && (
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes' ||
    window.doNotTrack === '1'
  )) {
    if (config.debug) {
      console.log('[Do11y] Disabled: Do Not Track is enabled');
    }
    return true;
  }

  if (config.allowedDomains && config.allowedDomains.length > 0) {
    const currentDomain = window.location.hostname;
    const isAllowed = config.allowedDomains.some((domain) => {
      return currentDomain === domain || currentDomain.endsWith('.' + domain);
    });
    if (!isAllowed) {
      if (config.debug) {
        console.log('[Do11y] Disabled: Domain not allowed:', currentDomain);
      }
      return true;
    }
  }

  return false;
}

/**
 * Validate a CSS selector string supplied through user configuration.
 * Returns the selector unchanged if it is syntactically valid, or null
 * if it is not. This prevents CSS selector injection from attacker-
 * controlled config values (window.Do11yConfig / meta tags) reaching
 * querySelectorAll / closest calls.
 */
function validateSelector(selector: string | null | undefined): string | null {
  if (!selector || typeof selector !== 'string') return null;
  try {
    document.querySelector(selector);
    return selector;
  } catch {
    if (config.debug) {
      console.warn('[Do11y] Invalid CSS selector rejected:', selector);
    }
    return null;
  }
}

function getElementClassName(el: Element): string {
  if (typeof el.className === 'string') return el.className;
  const svgClass = el.className as SVGAnimatedString;
  if (svgClass && typeof svgClass.baseVal === 'string') return svgClass.baseVal;
  return '';
}

function languageFromClassName(className: string): string | null {
  const match = className.match(/(?:^|\s)language-([\w-]+)(?:\s|$)/);
  return match ? match[1]! : null;
}

/**
 * Read the code block language from the element and its ancestors.
 * Frameworks often put `language-*` on a wrapper div (VitePress, Prism)
 * rather than on the pre/code element itself.
 */
function extractCodeLanguage(start: Element | null): string {
  if (!start) return 'unknown';

  let el: Element | null = start;
  for (let depth = 0; el && depth < 12; depth++, el = el.parentElement) {
    for (const attr of ['language', 'data-language', 'data-lang', 'data-code-lang']) {
      const value = el.getAttribute(attr);
      if (value) return value;
    }

    const fromClass = languageFromClassName(getElementClassName(el));
    if (fromClass) return fromClass;

    // VitePress renders <span class="lang">bash</span> beside the copy button.
    const langSpan = el.querySelector(':scope > span.lang');
    const langText = langSpan?.textContent?.trim();
    if (langText) return langText;

    // Broader search: any descendant with language metadata
    // (catches cases where language is nested deeper in the subtree,
    //  e.g. Mintlify's <pre language="mdx"> / <code language="mdx">).
    const deepLang = el.querySelector(
      '[data-language], [data-lang], [data-code-lang], [class*="language-"], [language]'
    );
    if (deepLang) {
      const dl =
        deepLang.getAttribute('language') ??
        deepLang.getAttribute('data-language') ??
        deepLang.getAttribute('data-lang') ??
        deepLang.getAttribute('data-code-lang') ??
        languageFromClassName(getElementClassName(deepLang));
      if (dl) return dl;
    }
  }

  return 'unknown';
}

function resolveTocHash(href: string): string | null {
  if (href.startsWith('#')) return href;
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return null;
  const pathPart = href.slice(0, hashIndex);
  if (
    !pathPart ||
    pathPart === window.location.pathname ||
    pathPart === `${window.location.pathname}${window.location.search}`
  ) {
    return href.slice(hashIndex);
  }
  return null;
}

function resolveTocContainer(link: Element): Element | null {
  const selector =
    validateSelector(config.tocSelector) ??
    '.table-of-contents, .VPDocAsideOutline, .VPLocalNavOutlineDropdown, ' +
    '[class*="toc"], [class*="TableOfContents"], [class*="page-outline"], ' +
    '.right-sidebar-panel, starlight-toc';

  let container = link.closest(selector);
  if (!container) return null;

  // Avoid treating the link itself as the container (for example a.outline-link).
  if (container === link || container.tagName === 'A') {
    container =
      link.closest('.VPDocAsideOutline, .VPLocalNavOutlineDropdown, nav, aside, .right-sidebar-panel, starlight-toc') ??
      container.parentElement;
  }

  return container;
}

function sanitizeText(text: string | null | undefined, maxLength?: number): string | null {
  if (!text || typeof text !== 'string') return null;

  const limit = maxLength ?? 100;

  let sanitized = text;
  // Email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  // US phone numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
  // SSNs
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted]');
  // Credit card numbers (13–19 digits, optionally space/dash separated)
  sanitized = sanitized.replace(/\b(?:\d[ -]?){13,19}\b/g, '[card]');
  // JWTs (three base64url segments separated by dots)
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]');
  // API tokens and generic bearer-style tokens (xaat-..., xapt-..., etc.)
  sanitized = sanitized.replace(/\bxa[a-z]{2}-[A-Za-z0-9_-]{20,}/g, '[token]');
  // Generic long hex secrets (32+ hex chars)
  sanitized = sanitized.replace(/\b[0-9a-fA-F]{32,}\b/g, '[redacted]');

  return sanitized.trim().substring(0, limit);
}

// ============================================================
// Session Management (No Cookies)
// ============================================================
// Session data is stored in sessionStorage. sessionStorage is readable
// by any JavaScript running on the same origin, so it should never
// contain secrets. The session record holds only an anonymous ID and
// a path-visit sequence (no query parameters, no PII). It is cleared
// automatically when the browser tab closes.

interface SessionData {
  id: string;
  startTime: string;
  pageSequence: Array<{ path: string; timestamp: string; index: number }>;
  pageCount: number;
  referrerCategory: string | null;
  aiPlatform: string | null;
}

function generateSessionId(): string {
  // Math.random() is not cryptographically secure and must not be used as
  // a fallback for session ID generation. Both crypto APIs below are
  // available in every browser that supports fetch (our minimum baseline).
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    arr[6] = (arr[6]! & 0x0f) | 0x40;
    arr[8] = (arr[8]! & 0x3f) | 0x80;
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return (
      hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20)
    );
  }
  // crypto is unavailable — return a fixed sentinel so the event is still
  // recorded but is clearly not a real session ID, rather than using
  // a predictable Math.random()-based value.
  return 'no-crypto-00-0000-0000-000000000000';
}

function isValidSessionData(value: unknown): value is SessionData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' && v.id.length > 0 &&
    typeof v.startTime === 'string' &&
    Array.isArray(v.pageSequence) &&
    typeof v.pageCount === 'number'
  );
}

function getSession(): SessionData {
  let session: SessionData | null = null;
  try {
    const stored = sessionStorage.getItem('do11y_session');
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isValidSessionData(parsed)) {
        session = parsed;
      }
    }
  } catch {
    // sessionStorage not available or parsing error
  }

  if (!session) {
    session = {
      id: generateSessionId(),
      startTime: new Date().toISOString(),
      pageSequence: [],
      pageCount: 0,
      referrerCategory: null,
      aiPlatform: null,
    };
    saveSession(session);
  }

  return session;
}

function saveSession(session: SessionData): void {
  try {
    sessionStorage.setItem('do11y_session', JSON.stringify(session));
  } catch {
    // sessionStorage not available
  }
}

function updatePageSequence(path: string): SessionData {
  const session = getSession();
  session.pageCount++;
  session.pageSequence.push({
    path,
    timestamp: new Date().toISOString(),
    index: session.pageCount,
  });
  if (session.pageSequence.length > 50) {
    session.pageSequence = session.pageSequence.slice(-50);
  }
  saveSession(session);
  return session;
}

// ============================================================
// Data Collection (Privacy-First)
// ============================================================

interface BrowserContext {
  [ATTR_DO11Y_VIEWPORT_CATEGORY]: string;
  [ATTR_BROWSER_FAMILY]: string;
  [ATTR_DEVICE_TYPE]: string;
  [ATTR_BROWSER_LANGUAGE]: string;
  [ATTR_DO11Y_TIMEZONE_OFFSET]: number;
}

function getBrowserContext(): BrowserContext {
  return {
    [ATTR_DO11Y_VIEWPORT_CATEGORY]: categorizeViewport(),
    [ATTR_BROWSER_FAMILY]: getBrowserFamily(),
    [ATTR_DEVICE_TYPE]: getDeviceType(),
    [ATTR_BROWSER_LANGUAGE]: (navigator.language || '').split('-')[0] || 'unknown',
    [ATTR_DO11Y_TIMEZONE_OFFSET]: new Date().getTimezoneOffset() / 60,
  };
}

function categorizeViewport(): string {
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  return 'large-desktop';
}

function getBrowserFamily(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad/.test(ua)) {
    if (/iPad|Tablet/.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Known AI platform referrer patterns.
 * Each entry maps a substring found in the referrer hostname to an AI
 * platform label. Order matters: first match wins.
 */
const AI_REFERRER_PATTERNS: ReadonlyArray<{ match: string; platform: string }> = [
  { match: 'chatgpt',    platform: 'ChatGPT' },
  { match: 'chat.com',   platform: 'ChatGPT' },
  { match: 'openai',     platform: 'ChatGPT' },
  { match: 'perplexity', platform: 'Perplexity' },
  { match: 'claude.ai',  platform: 'Claude' },
  { match: 'anthropic',  platform: 'Claude' },
  { match: 'gemini',     platform: 'Gemini' },
  { match: 'copilot',    platform: 'Copilot' },
  { match: 'deepseek',   platform: 'DeepSeek' },
  { match: 'meta.ai',    platform: 'Meta AI' },
  { match: 'grok',       platform: 'Grok' },
  { match: 'x.ai',       platform: 'Grok' },
  { match: 'mistral',    platform: 'Mistral' },
  { match: 'you.com',    platform: 'You.com' },
  { match: 'phind',      platform: 'Phind' },
];

interface ReferrerInfo {
  referrerCategory: string;
  aiPlatform: string | null;
}

/**
 * Classify a referrer hostname into a traffic source category.
 * Returns { referrerCategory, aiPlatform } where aiPlatform is null
 * for non-AI traffic.
 */
function classifyReferrer(hostname: string): ReferrerInfo {
  if (!hostname || hostname === 'direct') {
    return { referrerCategory: 'direct', aiPlatform: null };
  }
  if (hostname === 'internal') {
    return { referrerCategory: 'internal', aiPlatform: null };
  }
  if (hostname === 'unknown') {
    return { referrerCategory: 'unknown', aiPlatform: null };
  }

  const h = hostname.toLowerCase();

  for (const pattern of AI_REFERRER_PATTERNS) {
    if (h.indexOf(pattern.match) !== -1) {
      return { referrerCategory: 'ai', aiPlatform: pattern.platform };
    }
  }

  if (/google\.|bing\.|baidu\.|yandex\.|duckduckgo\.|yahoo\./.test(h)) {
    return { referrerCategory: 'search-engine', aiPlatform: null };
  }
  if (/github\.|gitlab\.|bitbucket\./.test(h)) {
    return { referrerCategory: 'code-host', aiPlatform: null };
  }
  if (/stackoverflow\.|stackexchange\.|reddit\.|news\.ycombinator\./.test(h)) {
    return { referrerCategory: 'community', aiPlatform: null };
  }
  if (/twitter\.|x\.com|linkedin\.|facebook\.|threads\.net/.test(h)) {
    return { referrerCategory: 'social', aiPlatform: null };
  }

  return { referrerCategory: 'other', aiPlatform: null };
}

function getReferrerDomain(): string {
  try {
    if (!document.referrer) return 'direct';
    const url = new URL(document.referrer);
    if (url.hostname === window.location.hostname) return 'internal';
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

interface PageInfo {
  [ATTR_URL_PATH]: string;
  [ATTR_URL_FRAGMENT]: string | null;
  [ATTR_URL_QUERY]: string | null;
  [ATTR_DO11Y_PAGE_TITLE]: string | null;
}

function getPageInfo(): PageInfo {
  return {
    [ATTR_URL_PATH]: window.location.pathname,
    [ATTR_URL_FRAGMENT]: window.location.hash || null,
    [ATTR_URL_QUERY]: window.location.search ? 'has_params' : null,
    [ATTR_DO11Y_PAGE_TITLE]: sanitizeText(document.title, 150),
  };
}

// ============================================================
// Event Batching & Sending
// ============================================================

let eventQueue: Do11yEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const lastEventTime: Record<string, number> = {};
let isDisabled = false;

function queueEvent(eventName: string, eventData: Record<string, unknown>): void {
  if (isDisabled) return;

  const now = Date.now();
  if (config.rateLimitMs > 0 && lastEventTime[eventName]) {
    if (now - lastEventTime[eventName] < config.rateLimitMs) {
      if (config.debug) {
        console.log('[Do11y] Rate limited:', eventName);
      }
      return;
    }
  }
  lastEventTime[eventName] = now;

  const session = getSession();

  // Build event with OTel semantic convention attribute keys
  const event: Record<string, unknown> = {
    _time: new Date().toISOString(),
    eventName,
    [ATTR_DO11Y_DO11Y_VERSION]: VERSION,
    [ATTR_SESSION_ID]: session.id,
    [ATTR_DO11Y_SESSION_PAGE_COUNT]: session.pageCount,
    ...getPageInfo(),
    ...getBrowserContext(),
    ...eventData,
  };

  if (config.debug) {
    console.log('[Do11y] Event queued:', eventName, event);
  }

  // In OTLP mode, emit directly through the OTel SDK
  if (config.destination === 'otlp' && _otelLogger) {
    _otelLogger.emit({
      eventName,
      severityNumber: 9, // SEVERITY_NUMBER_INFO
      attributes: event,
      body: '',
    });
    return;
  }

  // In HTTP/Supabase mode, queue for batching
  eventQueue.push(event as Do11yEvent);

  if (eventQueue.length > 100) {
    eventQueue = eventQueue.slice(-100);
    if (config.debug) {
      console.warn('[Do11y] Event queue capped at 100 events');
    }
  }

  if (eventQueue.length >= config.maxBatchSize) {
    flush();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(flush, config.flushInterval);
}

let _otelLogger: { emit: (record: { eventName: string; severityNumber: number; attributes: Record<string, unknown>; body: string }) => void } | null = null;

function validateSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.endsWith('.supabase.co')) return false;
    return true;
  } catch {
    return false;
  }
}

function validateEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function validateConfig(): boolean {
  if (config.destination === 'supabase') {
    if (!config.supabaseUrl) {
      if (config.debug) {
        console.warn('[Do11y] No Supabase URL configured');
      }
      return false;
    }

    if (!validateSupabaseUrl(config.supabaseUrl)) {
      if (config.debug) {
        console.warn('[Do11y] Invalid Supabase URL. Must be https://<project>.supabase.co');
      }
      return false;
    }

    if (!config.supabaseKey || typeof config.supabaseKey !== 'string' || config.supabaseKey.length < 10) {
      if (config.debug) {
        console.warn('[Do11y] Invalid or missing Supabase publishable key');
      }
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(config.supabaseTable)) {
      if (config.debug) {
        console.warn('[Do11y] Invalid table name');
      }
      return false;
    }

    return true;
  }

  if (config.destination === 'http') {
    if (!config.endpoint) {
      if (config.debug) {
        console.warn('[Do11y] No HTTP endpoint configured');
      }
      return false;
    }

    if (!validateEndpoint(config.endpoint)) {
      if (config.debug) {
        console.warn('[Do11y] Invalid HTTP endpoint. Must be HTTPS and not a private address.');
      }
      return false;
    }

    return true;
  }

  if (config.destination === 'otlp') {
    if (!config.otelSdkEndpoint) {
      if (config.debug) {
        console.warn('[Do11y] No OTLP endpoint configured');
      }
      return false;
    }

    // Lazy init the OTel SDK on first validateConfig call
    initOtelSdk().catch((err) => {
      if (config.debug) {
        console.warn('[Do11y] OTel SDK initialization failed:', err);
      }
    });

    return true;
  }

  if (config.debug) {
    console.warn('[Do11y] Unknown destination:', config.destination);
  }
  return false;
}

/**
 * Dynamically import the OTel Browser SDK and set up the LoggerProvider.
 * Only called when destination is 'otlp'.
 */
async function initOtelSdk(): Promise<void> {
  if (_otelLogger) return; // already initialized

  const cdnBase = config.otelSdkCdnUrl.replace(/\/$/, '');
  const apiLogs = await import(/* @vite-ignore */ `${cdnBase}@opentelemetry/api-logs`);
  const sdkLogs = await import(/* @vite-ignore */ `${cdnBase}@opentelemetry/sdk-logs`);
  const otlpExporter = await import(/* @vite-ignore */ `${cdnBase}@opentelemetry/exporter-logs-otlp-http`);

  const resourceAttrs: Record<string, string> = {
    'service.name': config.otelSdkServiceName || 'do11y',
    'service.version': VERSION,
    'telemetry.sdk.name': 'do11y',
    'telemetry.sdk.language': 'webjs',
    'telemetry.sdk.version': VERSION,
    ...config.otelSdkResourceAttributes,
  };

  const loggerProvider = new sdkLogs.LoggerProvider({
    resource: {
      attributes: resourceAttrs,
    },
    processors: [
      new sdkLogs.BatchLogRecordProcessor({
        exporter: new otlpExporter.OTLPLogExporter({
          url: config.otelSdkEndpoint.replace(/\/$/, '') + '/v1/logs',
          headers: config.otelSdkHeaders,
        }),
      }),
    ],
  });

  apiLogs.logs.setGlobalLoggerProvider(loggerProvider);
  _otelLogger = loggerProvider.getLogger('do11y');

  if (config.debug) {
    console.log('[Do11y] OTel SDK initialized with endpoint:', config.otelSdkEndpoint);
  }
}

function buildRequest(events: Do11yEvent[]): { url: string; headers: Record<string, string>; body: string } {
  if (config.destination === 'supabase') {
    const url = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + config.supabaseTable;
    const bodyTransform = config.bodyTransform ?? ((evts: object[]) => (evts as object[]).map((e) => ({ payload: e })));
    return {
      url,
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': 'Bearer ' + config.supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(bodyTransform(events)),
    };
  }

  // http destination
  const bodyTransform = config.bodyTransform ?? ((evts: object[]) => evts);
  return {
    url: config.endpoint,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: JSON.stringify(bodyTransform(events)),
  };
}

function flush(retriesLeft?: number): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) return;
  if (!validateConfig()) return;

  const retries = typeof retriesLeft === 'number' ? retriesLeft : config.maxRetries;

  const events = eventQueue.slice();
  eventQueue = [];

  const req = buildRequest(events);
  sendEvents(req, events, retries);
}

/**
 * Check whether a request URL is cross-origin relative to the current page.
 */
function isCrossOrigin(url: string): boolean {
  try {
    const reqUrl = new URL(url);
    return reqUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function sendEvents(req: { url: string; headers: Record<string, string>; body: string }, events: Do11yEvent[], retriesLeft: number): void {
  const crossOrigin = isCrossOrigin(req.url);

  if (config.debug && crossOrigin) {
    console.log('[Do11y] Cross-origin request to', new URL(req.url).origin, '- requires CORS headers on the server');
  }

  fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    keepalive: true,
    mode: crossOrigin ? 'cors' : 'same-origin',
  }).then((response) => {
    if (response.ok) {
      if (config.debug) {
        console.log('[Do11y] Flushed', events.length, 'events');
      }
      return;
    }

    if (retriesLeft > 0 && (response.status >= 500 || response.status === 429)) {
      if (config.debug) {
        console.log('[Do11y] Retrying after error:', response.status);
      }
      eventQueue = events.concat(eventQueue);
      setTimeout(() => {
        flush(retriesLeft - 1);
      }, config.retryDelay * (config.maxRetries - retriesLeft + 1));
      return;
    }

    if (config.debug) {
      response.text().then((text) => {
        const msg = `[Do11y] Ingest failed: ${response.status}`;
        // Detect common CORS failure (opaque response in no-cors mode)
        if (response.status === 0 && response.type === 'opaque') {
          console.error(msg, '- CORS error: server did not return Access-Control-Allow-Origin');
        } else {
          console.error(msg, text);
        }
      }).catch(() => { /* ignore */ });
    }
  }).catch((err: Error) => {
    // TypeError with "Failed to fetch" usually means CORS or network failure
    if (retriesLeft > 0) {
      if (config.debug) {
        const hint = crossOrigin
          ? ' (this may be a CORS issue — try using an OTel Collector proxy)'
          : '';
        console.log('[Do11y] Network error, retrying:', err.message + hint);
      }
      eventQueue = events.concat(eventQueue);
      setTimeout(() => {
        flush(retriesLeft - 1);
      }, config.retryDelay * (config.maxRetries - retriesLeft + 1));
    } else if (config.debug) {
      console.error('[Do11y] Failed to send events:', err.message);
    }
  });
}

/**
 * Synchronous flush used on `beforeunload`. For OTLP mode the SDK
 * handles flush on its own; for HTTP/Supabase we use fetch with keepalive.
 */
function flushSync(): void {
  if (config.destination === 'otlp') {
    return; // OTel SDK handles unload flushing
  }

  if (eventQueue.length === 0) return;
  if (!validateConfig()) return;

  const events = eventQueue;
  eventQueue = [];

  const req = buildRequest(events);

  try {
    fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
      keepalive: true,
    });
  } catch {
    // Best effort - ignore errors on page unload
  }

  if (config.debug) {
    console.log('[Do11y] Sync flushed', events.length, 'events');
  }
}

// ============================================================
// Page View Tracking
// ============================================================

function trackPageView(): void {
  const session = updatePageSequence(window.location.pathname);

  const referrerDomain = getReferrerDomain();
  const referrerInfo = classifyReferrer(referrerDomain);

  if (session.pageCount === 1) {
    session.referrerCategory = referrerInfo.referrerCategory;
    session.aiPlatform = referrerInfo.aiPlatform;
    saveSession(session);
  }

  queueEvent(EVENT_PAGE_VIEW, {
    [ATTR_DO11Y_REFERRER_DOMAIN]: referrerDomain,
    [ATTR_DO11Y_REFERRER_CATEGORY]: referrerInfo.referrerCategory,
    [ATTR_DO11Y_AI_PLATFORM]: referrerInfo.aiPlatform,
    [ATTR_DO11Y_IS_FIRST_PAGE]: session.pageCount === 1,
    [ATTR_DO11Y_PREVIOUS_PATH]: session.pageSequence.length > 1
      ? session.pageSequence[session.pageSequence.length - 2]!.path
      : null,
  });
}

// ============================================================
// Link Click Tracking
// ============================================================

function setupLinkTracking(): void {
  // Use capture phase so the handler fires before SPA routers (VitePress,
  // Docusaurus, Nextra, etc.) can call stopPropagation / stopImmediatePropagation.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    let linkType = 'other';
    let targetDomain: string | null = null;

    try {
      if (href.startsWith('#')) {
        linkType = 'anchor';
      } else if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
        linkType = 'internal';
      } else if (href.startsWith('http')) {
        const url = new URL(href);
        if (url.hostname === window.location.hostname) {
          linkType = 'internal';
        } else {
          linkType = 'external';
          targetDomain = url.hostname;
        }
      } else if (href.startsWith('mailto:')) {
        linkType = 'email';
      }
    } catch {
      // Invalid URL
    }

    if (linkType === 'internal' && !config.trackInternalLinks) return;
    if (linkType === 'external' && !config.trackOutboundLinks) return;

    queueEvent(EVENT_LINK_CLICK, {
      [ATTR_DO11Y_LINK_TYPE]: linkType,
      [ATTR_DO11Y_LINK_TARGET_URL]: href,
      [ATTR_DO11Y_LINK_TARGET_DOMAIN]: targetDomain,
      [ATTR_DO11Y_LINK_TEXT]: sanitizeText(link.textContent, 100),
      [ATTR_DO11Y_LINK_CONTEXT]: getLinkContext(link),
      [ATTR_DO11Y_LINK_SECTION]: sanitizeText(getNearestHeading(link), 100),
      [ATTR_DO11Y_LINK_INDEX]: getLinkIndex(link, href),
    });

    // Flush immediately — external links may unload the page, and
    // SPA routers may replace content before the scheduled flush fires
    flush();
  }, true);
}

function getLinkContext(link: Element): string {
  if (link.closest(config.navigationSelector!)) return 'navigation';
  if (link.closest(config.footerSelector!)) return 'footer';
  if (link.closest(config.contentSelector!)) return 'content';
  return 'other';
}

function getNearestHeading(element: Element): string | null {
  let current: Element | null = element;

  while (current && current !== document.body) {
    let sibling: Element | null = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        return sibling.textContent?.trim().substring(0, 100) ?? null;
      }
      const headings = sibling.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length > 0) {
        return headings[headings.length - 1]!.textContent?.trim().substring(0, 100) ?? null;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return null;
}

function getLinkIndex(link: Element, href: string): number {
  if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return 1;
  try {
    const allLinks = document.querySelectorAll('a[href="' + CSS.escape(href) + '"]');
    for (let i = 0; i < allLinks.length; i++) {
      if (allLinks[i] === link) return i + 1;
    }
  } catch {
    // Selector failed (malformed href), fall back to 1
  }
  return 1;
}

// ============================================================
// Scroll Depth Tracking
// ============================================================

let trackedScrollDepths = new Set<number>();
let scrollContainer: Element | null = null;

function findScrollableAncestor(el: Element): Element | null {
  let current: Element | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') &&
        current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Track scroll depth.
 *
 * Some frameworks (MkDocs Material) use container-based
 * scrolling where the window itself never scrolls. We detect the scrollable
 * container by walking up from the content element and listen on it in
 * addition to the window.
 */
function setupScrollTracking(): void {
  if (!config.trackScrollDepth) return;

  if (config.contentSelector) {
    const contentEl = document.querySelector(config.contentSelector);
    if (contentEl) {
      scrollContainer = findScrollableAncestor(contentEl);
    }
  }

  let ticking = false;
  function onScroll(): void {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        checkScrollDepth();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll);
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', onScroll);
    if (config.debug) {
      const sc = scrollContainer as HTMLElement;
      console.log('[do11y] Using container-based scroll tracking:', sc.className || sc.tagName);
    }
  }

  // Run once on init so short pages that fit in the viewport get
  // recorded immediately (no scroll event will ever fire for them).
  checkScrollDepth();
}

/**
 * Check and track scroll depth thresholds.
 * Reads from the detected scroll container when present, otherwise
 * falls back to the window/document.
 *
 * If the page fits entirely in the viewport (no scrollbar), all
 * thresholds are marked as reached since the user can see 100% of
 * the content without scrolling.
 */
function checkScrollDepth(): void {
  let scrollTop: number;
  let totalHeight: number;
  let viewportHeight: number;

  if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
    scrollTop = scrollContainer.scrollTop;
    totalHeight = scrollContainer.scrollHeight;
    viewportHeight = scrollContainer.clientHeight;
  } else {
    scrollTop = window.scrollY || document.documentElement.scrollTop;
    totalHeight = document.documentElement.scrollHeight;
    viewportHeight = window.innerHeight;
  }

  const docHeight = totalHeight - viewportHeight;

  if (docHeight <= 0) {
    config.scrollThresholds.forEach((threshold) => {
      if (!trackedScrollDepths.has(threshold)) {
        trackedScrollDepths.add(threshold);
        queueEvent(EVENT_SCROLL_DEPTH, {
          [ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
          [ATTR_DO11Y_SCROLL_PERCENT]: 100,
        });
      }
    });
    return;
  }

  const scrollPercent = Math.round((scrollTop / docHeight) * 100);

  config.scrollThresholds.forEach((threshold) => {
    if (scrollPercent >= threshold && !trackedScrollDepths.has(threshold)) {
      trackedScrollDepths.add(threshold);
      queueEvent(EVENT_SCROLL_DEPTH, {
        [ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
        [ATTR_DO11Y_SCROLL_PERCENT]: scrollPercent,
      });
    }
  });
}

// ============================================================
// Time on Page Tracking
// ============================================================

let pageLoadTime = Date.now();
let lastActivityTime = Date.now();
let totalActiveTime = 0;
let isPageVisible = true;

function emitPageExit(): void {
  if (isPageVisible) {
    totalActiveTime += Date.now() - lastActivityTime;
  }

  const totalTime = Date.now() - pageLoadTime;
  const engagementRatio = totalTime > 0 ? totalActiveTime / totalTime : 0;

  let maxScroll = 0;
  trackedScrollDepths.forEach((depth) => {
    if (depth > maxScroll) maxScroll = depth;
  });

  flushVisibleSections();

  const session = getSession();

  queueEvent(EVENT_PAGE_EXIT, {
    [ATTR_DO11Y_TOTAL_TIME_SECONDS]: Math.round(totalTime / 1000),
    [ATTR_DO11Y_ACTIVE_TIME_SECONDS]: Math.round(totalActiveTime / 1000),
    [ATTR_DO11Y_ENGAGEMENT_RATIO]: Math.round(engagementRatio * 100) / 100,
    [ATTR_DO11Y_MAX_SCROLL_DEPTH]: maxScroll,
    [ATTR_DO11Y_REFERRER_CATEGORY]: session.referrerCategory,
    [ATTR_DO11Y_AI_PLATFORM]: session.aiPlatform,
  });
}

function setupEngagementTracking(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isPageVisible) {
        totalActiveTime += Date.now() - lastActivityTime;
        isPageVisible = false;
      }
    } else {
      lastActivityTime = Date.now();
      isPageVisible = true;
    }
  });

  window.addEventListener('beforeunload', () => {
    emitPageExit();
    cleanup();
  });
}

// ============================================================
// Search Tracking
// ============================================================

function setupSearchTracking(): void {
  // Use capture phase so the handler fires before framework event handlers
  // (e.g. Starlight's <site-search>) can call stopPropagation().
  document.addEventListener('click', (e) => {
    const searchTrigger = (e.target as Element).closest(config.searchSelector!);
    if (searchTrigger) {
      queueEvent(EVENT_SEARCH_OPENED, {});
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      queueEvent(EVENT_SEARCH_OPENED, { [ATTR_DO11Y_SEARCH_TRIGGER]: 'keyboard' });
    }
  });
}

// ============================================================
// Copy Code Tracking
// ============================================================

function getCodeBlockIndex(codeBlock: Element | null): number {
  if (!codeBlock) return 1;
  try {
    const allBlocks = document.querySelectorAll(config.codeBlockSelector!);
    for (let i = 0; i < allBlocks.length; i++) {
      if (allBlocks[i] === codeBlock) return i + 1;
    }
  } catch {
    // Selector failed
  }
  return 1;
}

function setupCopyTracking(): void {
  document.addEventListener('click', (e) => {
    const copyButton = (e.target as Element).closest(config.copyButtonSelector!);
    if (copyButton) {
      const codeBlock: Element | null =
        copyButton.closest('[class*="language-"], [language]') ??
        copyButton.closest(config.codeBlockSelector!) ??
        // For Starlight / Expressive Code: the <pre> is a sibling, not
        // an ancestor, of the copy button's container. Look for it
        // inside the .expressive-code wrapper.
        copyButton.closest('.expressive-code')?.querySelector('pre') ??
        copyButton.closest('div, section')?.querySelector('pre') ??
        copyButton.parentElement?.querySelector('pre') ??
        null;

      const codeEl: Element | null = codeBlock
        ? (codeBlock.tagName === 'PRE'
          ? codeBlock.querySelector('code')
          : codeBlock.querySelector('code[class*="language-"], code[language]') ?? codeBlock.querySelector('code'))
        : null;

      const language = extractCodeLanguage(codeEl ?? codeBlock ?? copyButton);

      queueEvent(EVENT_CODE_COPIED, {
        [ATTR_DO11Y_CODE_LANGUAGE]: language,
        [ATTR_DO11Y_CODE_SECTION]: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
        [ATTR_DO11Y_CODE_INDEX]: getCodeBlockIndex(codeBlock),
      });
    }
  }, true);
}

// ============================================================
// Section Visibility Tracking
// ============================================================

let sectionObserver: IntersectionObserver | null = null;
let sectionTimers: Record<string, { start: number; reported: boolean }> = {};

function setupSectionVisibilityTracking(): void {
  if (!config.trackSectionVisibility) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const threshold = config.sectionVisibleThreshold * 1000;

  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute('data-do11y-section-id');
      if (!id) return;

      if (entry.isIntersecting) {
        if (!sectionTimers[id]) {
          sectionTimers[id] = { start: Date.now(), reported: false };
        }
      } else {
        if (sectionTimers[id] && !sectionTimers[id].reported) {
          const elapsed = Date.now() - sectionTimers[id].start;
          if (elapsed >= threshold) {
            const heading = entry.target.textContent?.trim() ?? '';
            queueEvent(EVENT_SECTION_VISIBLE, {
              [ATTR_DO11Y_SECTION_HEADING]: sanitizeText(heading, 100),
              [ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(entry.target.tagName.charAt(1), 10),
              [ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsed / 1000),
            });
            sectionTimers[id].reported = true;
          }
        }
        delete sectionTimers[id];
      }
    });
  }, { threshold: 0.5 });

  observeHeadings();
}

function observeHeadings(): void {
  if (!sectionObserver) return;
  const headings = document.querySelectorAll('h2, h3');
  headings.forEach((h, i) => {
    // Always overwrite any pre-existing attribute value. A heading authored
    // with a crafted data-do11y-section-id could otherwise inject an
    // unescaped string into the querySelector in flushVisibleSections().
    h.setAttribute('data-do11y-section-id', 'section-' + i);
    sectionObserver!.observe(h);
  });
}

function flushVisibleSections(): void {
  if (!sectionObserver) return;
  const now = Date.now();
  const threshold = config.sectionVisibleThreshold * 1000;
  Object.keys(sectionTimers).forEach((id) => {
    const timer = sectionTimers[id];
    if (timer && !timer.reported) {
      const elapsed = now - timer.start;
      if (elapsed >= threshold) {
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(id)
          : id.replace(/["\\]/g, '\\$&');
        const el = document.querySelector('[data-do11y-section-id="' + escapedId + '"]');
        if (el) {
          queueEvent(EVENT_SECTION_VISIBLE, {
            [ATTR_DO11Y_SECTION_HEADING]: sanitizeText(el.textContent?.trim() ?? '', 100),
            [ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(el.tagName.charAt(1), 10),
            [ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsed / 1000),
          });
        }
      }
    }
  });
  sectionTimers = {};
}

// ============================================================
// Tab Switch Tracking
// ============================================================

function setupTabSwitchTracking(): void {
  if (!config.trackTabSwitches) return;

  document.addEventListener('click', (e) => {
    let baseSel = '[role="tab"], .tabs button, .tabs a, .tabbed-labels label';
    const safeTabSel = validateSelector(config.tabContainerSelector);
    if (safeTabSel) {
      baseSel +=
        ', ' + safeTabSel + ' button, ' +
        safeTabSel + ' a, ' +
        safeTabSel + ' label';
    }
    const tab = (e.target as Element).closest(baseSel);
    if (!tab) return;

    const isAlreadyActive =
      tab.getAttribute('aria-selected') === 'true' ||
      tab.classList.contains('active') ||
      tab.classList.contains('is-active');
    if (isAlreadyActive) return;

    const label = sanitizeText(tab.textContent, 50);
    if (!label) return;

    const section = sanitizeText(getNearestHeading(tab), 100);

    queueEvent(EVENT_TAB_SWITCH, {
      [ATTR_DO11Y_TAB_LABEL]: label,
      [ATTR_DO11Y_TAB_GROUP]: section,
      [ATTR_DO11Y_TAB_IS_DEFAULT]: false,
    });
  });
}

// ============================================================
// TOC Click Tracking
// ============================================================

function setupTocClickTracking(): void {
  if (!config.trackTocClicks) return;

  // Use capture phase so the event is seen even if the framework
  // calls stopPropagation() during the bubble phase.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('a');
    if (!link) return;

    const tocContainer = resolveTocContainer(link);
    if (!tocContainer) return;

    const href = link.getAttribute('href');
    const hash = href ? resolveTocHash(href) : null;
    if (!hash) return;

    const headingText = sanitizeText(link.textContent, 100);
    let headingLevel: number | null = null;
    try {
      const targetId = hash.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl && /^H[1-6]$/.test(targetEl.tagName)) {
        headingLevel = parseInt(targetEl.tagName.charAt(1), 10);
      }
    } catch { /* ignore */ }

    const tocLinks = tocContainer.querySelectorAll('a[href*="#"]');
    let tocPosition = 1;
    for (let i = 0; i < tocLinks.length; i++) {
      if (tocLinks[i] === link) { tocPosition = i + 1; break; }
    }

    queueEvent(EVENT_TOC_CLICK, {
      [ATTR_DO11Y_TOC_HEADING]: headingText,
      [ATTR_DO11Y_TOC_HEADING_LEVEL]: headingLevel,
      [ATTR_DO11Y_TOC_POSITION]: tocPosition,
    });
  }, true);
}

// ============================================================
// Feedback Tracking
// ============================================================

function setupFeedbackTracking(): void {
  if (!config.trackFeedback) return;

  document.addEventListener('click', (e) => {
    const button = (e.target as Element).closest('button, [role="button"], a');
    if (!button) return;

    const feedbackContainer = button.closest(
      validateSelector(config.feedbackSelector) ??
      '[class*="feedback"], [class*="helpful"], [class*="rating"], ' +
      '[class*="was-this"], [data-feedback]'
    );
    if (!feedbackContainer) return;

    const buttonText = (button.textContent ?? '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') ?? '').toLowerCase();
    const titleAttr = (button.getAttribute('title') ?? '').toLowerCase();
    // data-md-value is used by MkDocs Material; data-value / data-feedback are used by other frameworks
    const rawDataValue =
      button.getAttribute('data-value') ??
      button.getAttribute('data-md-value') ??
      button.getAttribute('data-feedback');
    // Constrain data-value to a safe token: alphanumeric + common punctuation,
    // max 50 chars. Prevents arbitrary DOM-injected strings from reaching the
    // analytics dataset or a downstream dashboard unescaped.
    const dataValue = rawDataValue && /^[\w\s.,!?-]{1,50}$/.test(rawDataValue)
      ? rawDataValue
      : null;

    let rating: string | null = null;
    if (dataValue) {
      rating = dataValue;
    } else if (/\byes\b|👍|thumbs.?up|helpful/i.test(buttonText + ' ' + ariaLabel + ' ' + titleAttr)) {
      rating = 'yes';
    } else if (/\bno\b|👎|thumbs.?down|not.?helpful/i.test(buttonText + ' ' + ariaLabel + ' ' + titleAttr)) {
      rating = 'no';
    }
    if (!rating) return;

    queueEvent(EVENT_FEEDBACK, { [ATTR_DO11Y_FEEDBACK_RATING]: rating });
  });
}

// ============================================================
// Expand/Collapse Tracking
// ============================================================

function setupExpandCollapseTracking(): void {
  if (!config.trackExpandCollapse) return;

  // Native <details> elements
  document.addEventListener('toggle', (e) => {
    const details = e.target as HTMLDetailsElement;
    if (details.tagName !== 'DETAILS') return;

    const summary = details.querySelector('summary');
    const label = sanitizeText(summary ? summary.textContent : '', 100);

    queueEvent(EVENT_EXPAND_COLLAPSE, {
      [ATTR_DO11Y_EXPAND_SUMMARY]: label,
      [ATTR_DO11Y_EXPAND_ACTION]: details.open ? 'expand' : 'collapse',
      [ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(details), 100),
    });
  }, true);

  // Accordion-style elements controlled by aria-expanded
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest(
      '[aria-expanded], [class*="accordion"] button, [class*="collapsible"] button'
    );
    if (!trigger) return;
    if (trigger.closest('details')) return;
    // Sidebar navigation toggles (nextra, vitepress, mkdocs sidebar sections,
    // etc.) also use aria-expanded but are structural UI, not content
    // expandables. Exclude anything inside a navigation landmark.
    if (trigger.closest('nav, [role="navigation"], header')) return;

    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';

    queueEvent(EVENT_EXPAND_COLLAPSE, {
      [ATTR_DO11Y_EXPAND_SUMMARY]: sanitizeText(trigger.textContent, 100),
      [ATTR_DO11Y_EXPAND_ACTION]: wasExpanded ? 'collapse' : 'expand',
      [ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(trigger), 100),
    });
  });
}

// ============================================================
// Initialization
// ============================================================

let mutationObserver: MutationObserver | null = null;

function init(): void {
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
    config.framework = (metaFramework.getAttribute('content') ?? config.framework) as FrameworkPreset;
  }

  const metaUseOtelInstrumentations = document.querySelector('meta[name="do11y-use-otel-instrumentations"]');
  if (metaUseOtelInstrumentations && metaUseOtelInstrumentations.getAttribute('content') === 'true') {
    config.useOtelBrowserInstrumentations = true;
  }

  applyFrameworkSelectors();

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

  if (shouldDisableTracking()) {
    isDisabled = true;
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

  trackPageView();
  setupLinkTracking();
  setupScrollTracking();
  setupEngagementTracking();
  setupSearchTracking();
  setupCopyTracking();
  setupSectionVisibilityTracking();
  setupTabSwitchTracking();
  setupTocClickTracking();
  setupFeedbackTracking();
  setupExpandCollapseTracking();

  let lastPath = window.location.pathname;

  mutationObserver = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      emitPageExit();
      trackedScrollDepths = new Set();
      pageLoadTime = Date.now();
      lastActivityTime = Date.now();
      totalActiveTime = 0;
      isPageVisible = true;
      trackPageView();
      observeHeadings();
      checkScrollDepth();
    }
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      emitPageExit();
      trackedScrollDepths = new Set();
      pageLoadTime = Date.now();
      lastActivityTime = Date.now();
      totalActiveTime = 0;
      isPageVisible = true;
      trackPageView();
      observeHeadings();
      checkScrollDepth();
    }
  });

    // Freeze the resolved config so that third-party scripts loaded after
  // this point cannot mutate host, key, or any other field
  // through window.Do11yConfig or direct property assignment.
  Object.freeze(config);

  if (config.debug) console.log('[Do11y] Initialized successfully');
}

function cleanup(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (sectionObserver) {
    flushVisibleSections();
    sectionObserver.disconnect();
    sectionObserver = null;
  }
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  flushSync();
}

if (!_alreadyLoaded) {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Expose API for debugging and integration
// cleanup() and debug() are intentionally NOT exposed on window.Do11y.
// Exposing cleanup() would allow any third-party script to silently stop
// tracking. Exposing debug() would allow any script to enable verbose
// console output revealing the endpoint, dataset, and queued event data.
window.Do11y = window.Do11y ?? {
  getConfig: () => ({
    destination: config.destination,
    hasCredentials:
      config.destination === 'supabase' ? !!config.supabaseKey :
      config.destination === 'otlp' ? !!config.otelSdkEndpoint :
      !!config.endpoint,
    isDisabled,
    allowedDomains: config.allowedDomains,
    respectDNT: config.respectDNT,
  }),
  flush,
  isEnabled: () => {
    if (isDisabled) return false;
    if (config.destination === 'supabase') return !!config.supabaseKey;
    if (config.destination === 'otlp') return !!config.otelSdkEndpoint;
    return !!config.endpoint;
  },
  getQueueSize: () => eventQueue.length,
  version: VERSION,
};
