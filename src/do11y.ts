// Originally derived from https://github.com/axiomhq/do11y
/**
 * Do11y — Documentation Observability
 *
 * Framework-agnostic documentation observability. Works with any static-site
 * generator or docs framework including Mintlify, Docusaurus, Nextra,
 * GitBook, MkDocs Material, VitePress, and plain HTML.
 *
 * Set the `framework` config option to your docs framework. Supported
 * values: 'mintlify', 'docusaurus', 'nextra', 'gitbook', 'mkdocs-material',
 * 'vitepress'. Set to 'custom' and provide your own selectors if your
 * framework is not listed.
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
 *    <meta name="do11y-url" content="https://YOUR_PROJECT.supabase.co">
 *    <meta name="do11y-key" content="sb_publishable_...">
 *    <meta name="do11y-table" content="do11y_events">
 *    <meta name="do11y-framework" content="mintlify">
 * 2. window.Do11yConfig object (set in a separate script before this file):
 *    window.Do11yConfig = { supabaseUrl: '...', supabaseKey: 'sb_publishable_...', framework: 'mintlify' };
 * 3. The config object below (defaults).
 *
 * Using meta tags or window.Do11yConfig is recommended so you can
 * update do11y.js without losing your settings.
 */

// ============================================================
// Types
// ============================================================

export type FrameworkPreset =
  | 'mintlify'
  | 'docusaurus'
  | 'nextra'
  | 'gitbook'
  | 'mkdocs-material'
  | 'vitepress'
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

export type Destination = 'supabase' | 'http';

export interface Do11yConfig {
  destination: Destination;
  supabaseUrl: string;
  supabaseKey: string;
  supabaseTable: string;
  httpEndpoint: string;
  httpHeaders: Record<string, string>;
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
}

export interface Do11yEvent {
  _time: string;
  eventType: string;
  sessionId: string;
  sessionPageCount: number;
  path: string;
  hash: string | null;
  search: string | null;
  title: string | null;
  viewportCategory: string;
  browserFamily: string;
  deviceType: string;
  language: string;
  timezoneOffset: number;
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

const VERSION = '0.0.2';

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
  httpEndpoint: '',
  httpHeaders: {},
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
};

// ============================================================
// Framework Selector Presets
// ============================================================

const FRAMEWORK_PRESETS: Record<string, FrameworkSelectors> = {
  mintlify: {
    searchSelector: '#search-bar-entry, #search-bar-entry-mobile, [class*="search"]',
    copyButtonSelector: '[class*="copy"], button[aria-label*="copy" i]',
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
  gitbook: {
    searchSelector: '[data-testid*="search"], button[aria-label*="search" i]',
    copyButtonSelector: '[class*="copy"], button[aria-label*="copy" i]',
    codeBlockSelector: 'pre, code, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '[class*="table-of-contents"], [class*="toc"], [class*="page-outline"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"], [class*="rating"]',
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

/** Paths that are not documentation pages (for example tracking pixels). */
const ENGAGEMENT_EXCLUDED_PATH_PREFIXES = ['/pixel/'];

function isEngagementExcludedPath(path?: string): boolean {
  const p = path ?? window.location.pathname;
  return ENGAGEMENT_EXCLUDED_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
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
    '[class*="toc"], [class*="TableOfContents"], [class*="page-outline"]';

  let container = link.closest(selector);
  if (!container) return null;

  // Avoid treating the link itself as the container (for example a.outline-link).
  if (container === link || container.tagName === 'A') {
    container =
      link.closest('.VPDocAsideOutline, .VPLocalNavOutlineDropdown, nav, aside') ??
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
  viewportCategory: string;
  browserFamily: string;
  deviceType: string;
  language: string;
  timezoneOffset: number;
}

function getBrowserContext(): BrowserContext {
  return {
    viewportCategory: categorizeViewport(),
    browserFamily: getBrowserFamily(),
    deviceType: getDeviceType(),
    language: (navigator.language || '').split('-')[0] || 'unknown',
    timezoneOffset: new Date().getTimezoneOffset() / 60,
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
  path: string;
  hash: string | null;
  search: string | null;
  title: string | null;
}

function getPageInfo(): PageInfo {
  return {
    path: window.location.pathname,
    hash: window.location.hash || null,
    search: window.location.search ? 'has_params' : null,
    title: sanitizeText(document.title, 150),
  };
}

// ============================================================
// Event Batching & Sending
// ============================================================

let eventQueue: Do11yEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const lastEventTime: Record<string, number> = {};
let isDisabled = false;

function queueEvent(eventType: string, eventData: Record<string, unknown>): void {
  if (isDisabled) return;

  const now = Date.now();
  if (config.rateLimitMs > 0 && lastEventTime[eventType]) {
    if (now - lastEventTime[eventType] < config.rateLimitMs) {
      if (config.debug) {
        console.log('[Do11y] Rate limited:', eventType);
      }
      return;
    }
  }
  lastEventTime[eventType] = now;

  const session = getSession();

  const event: Do11yEvent = {
    _time: new Date().toISOString(),
    eventType,
    'do11y_version': VERSION,
    sessionId: session.id,
    sessionPageCount: session.pageCount,
    ...getPageInfo(),
    ...getBrowserContext(),
    ...eventData,
  };

  if (config.debug) {
    console.log('[Do11y] Event queued:', event);
  }

  eventQueue.push(event);

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

function validateHttpEndpoint(url: string): boolean {
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
    if (!config.httpEndpoint) {
      if (config.debug) {
        console.warn('[Do11y] No HTTP endpoint configured');
      }
      return false;
    }

    if (!validateHttpEndpoint(config.httpEndpoint)) {
      if (config.debug) {
        console.warn('[Do11y] Invalid HTTP endpoint. Must be HTTPS and not a private address.');
      }
      return false;
    }

    return true;
  }

  if (config.debug) {
    console.warn('[Do11y] Unknown destination:', config.destination);
  }
  return false;
}

function buildRequest(events: Do11yEvent[]): { url: string; headers: Record<string, string>; body: string } {
  if (config.destination === 'supabase') {
    const url = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + config.supabaseTable;
    return {
      url,
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': 'Bearer ' + config.supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(events.map((e) => ({ payload: e }))),
    };
  }

  return {
    url: config.httpEndpoint,
    headers: {
      'Content-Type': 'application/json',
      ...config.httpHeaders,
    },
    body: JSON.stringify(events),
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

function sendEvents(req: { url: string; headers: Record<string, string>; body: string }, events: Do11yEvent[], retriesLeft: number): void {
  fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    keepalive: true,
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
        console.error('[Do11y] Ingest failed:', response.status, text);
      }).catch(() => { /* ignore */ });
    }
  }).catch((err: Error) => {
    if (retriesLeft > 0) {
      if (config.debug) {
        console.log('[Do11y] Network error, retrying:', err.message);
      }
      eventQueue = events.concat(eventQueue);
      setTimeout(() => {
        flush(retriesLeft - 1);
      }, config.retryDelay * (config.maxRetries - retriesLeft + 1));
    } else if (config.debug) {
      console.error('[Do11y] Failed to send events:', err);
    }
  });
}

function flushSync(): void {
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

  queueEvent('page_view', {
    referrerDomain,
    referrerCategory: referrerInfo.referrerCategory,
    aiPlatform: referrerInfo.aiPlatform,
    isFirstPage: session.pageCount === 1,
    previousPath: session.pageSequence.length > 1
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

    queueEvent('link_click', {
      linkType,
      targetUrl: href,
      targetDomain,
      linkText: sanitizeText(link.textContent, 100),
      linkContext: getLinkContext(link),
      linkSection: sanitizeText(getNearestHeading(link), 100),
      linkIndex: getLinkIndex(link, href),
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
 * Some frameworks (GitBook/HonKit, MkDocs Material) use container-based
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
  if (isEngagementExcludedPath()) return;

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
        queueEvent('scroll_depth', { threshold, scrollPercent: 100 });
      }
    });
    return;
  }

  const scrollPercent = Math.round((scrollTop / docHeight) * 100);

  config.scrollThresholds.forEach((threshold) => {
    if (scrollPercent >= threshold && !trackedScrollDepths.has(threshold)) {
      trackedScrollDepths.add(threshold);
      queueEvent('scroll_depth', { threshold, scrollPercent });
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
  if (isEngagementExcludedPath()) return;

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

  queueEvent('page_exit', {
    totalTimeSeconds: Math.round(totalTime / 1000),
    activeTimeSeconds: Math.round(totalActiveTime / 1000),
    engagementRatio: Math.round(engagementRatio * 100) / 100,
    maxScrollDepth: maxScroll,
    referrerCategory: session.referrerCategory,
    aiPlatform: session.aiPlatform,
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
  document.addEventListener('click', (e) => {
    const searchTrigger = (e.target as Element).closest(config.searchSelector!);
    if (searchTrigger) {
      queueEvent('search_opened', {});
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      queueEvent('search_opened', { trigger: 'keyboard' });
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
        copyButton.closest('[class*="language-"]') ??
        copyButton.closest(config.codeBlockSelector!) ??
        copyButton.closest('div, section')?.querySelector('pre') ??
        copyButton.parentElement?.querySelector('pre') ??
        null;

      const codeEl: Element | null = codeBlock
        ? (codeBlock.tagName === 'PRE'
          ? codeBlock.querySelector('code')
          : codeBlock.querySelector('code[class*="language-"]') ?? codeBlock.querySelector('code'))
        : null;

      const language = extractCodeLanguage(codeEl ?? codeBlock ?? copyButton);

      queueEvent('code_copied', {
        language,
        codeSection: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
        codeBlockIndex: getCodeBlockIndex(codeBlock),
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
            queueEvent('section_visible', {
              heading: sanitizeText(heading, 100),
              headingLevel: parseInt(entry.target.tagName.charAt(1), 10),
              visibleSeconds: Math.round(elapsed / 1000),
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
          queueEvent('section_visible', {
            heading: sanitizeText(el.textContent?.trim() ?? '', 100),
            headingLevel: parseInt(el.tagName.charAt(1), 10),
            visibleSeconds: Math.round(elapsed / 1000),
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

    queueEvent('tab_switch', {
      tabLabel: label,
      tabGroup: section,
      isDefault: false,
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

    queueEvent('toc_click', {
      heading: headingText,
      headingLevel,
      tocPosition,
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

    queueEvent('feedback', { rating });
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

    queueEvent('expand_collapse', {
      summary: label,
      action: details.open ? 'expand' : 'collapse',
      section: sanitizeText(getNearestHeading(details), 100),
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

    queueEvent('expand_collapse', {
      summary: sanitizeText(trigger.textContent, 100),
      action: wasExpanded ? 'collapse' : 'expand',
      section: sanitizeText(getNearestHeading(trigger), 100),
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
    if (dest === 'supabase' || dest === 'http') config.destination = dest;
  }

  const metaUrl = document.querySelector('meta[name="do11y-url"]');
  if (metaUrl) config.supabaseUrl = metaUrl.getAttribute('content') ?? config.supabaseUrl;

  const metaKey = document.querySelector('meta[name="do11y-key"]');
  if (metaKey) config.supabaseKey = metaKey.getAttribute('content') ?? config.supabaseKey;

  const metaTable = document.querySelector('meta[name="do11y-table"]');
  if (metaTable) config.supabaseTable = metaTable.getAttribute('content') ?? config.supabaseTable;

  const metaHttpEndpoint = document.querySelector('meta[name="do11y-http-endpoint"]');
  if (metaHttpEndpoint) config.httpEndpoint = metaHttpEndpoint.getAttribute('content') ?? config.httpEndpoint;

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

  applyFrameworkSelectors();

  if (config.debug) {
    console.log('[Do11y] Initializing with config:', {
      destination: config.destination,
      hasCredentials: config.destination === 'supabase' ? !!config.supabaseKey : !!config.httpEndpoint,
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

  const hasDestination = config.destination === 'supabase' ? !!config.supabaseKey : !!config.httpEndpoint;
  if (!hasDestination) {
    if (config.debug) {
      console.warn('[Do11y] No destination configured. Events will not be sent.');
      console.warn('[Do11y] Add <meta name="do11y-url"> and <meta name="do11y-key"> to enable.');
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
    hasCredentials: config.destination === 'supabase' ? !!config.supabaseKey : !!config.httpEndpoint,
    isDisabled,
    allowedDomains: config.allowedDomains,
    respectDNT: config.respectDNT,
  }),
  flush,
  isEnabled: () => !isDisabled && (config.destination === 'supabase' ? !!config.supabaseKey : !!config.httpEndpoint),
  getQueueSize: () => eventQueue.length,
  version: VERSION,
};
