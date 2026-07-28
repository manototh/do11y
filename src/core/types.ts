/**
 * Do11y — Documentation Observability
 *
 * Shared type definitions used by all distribution layers.
 */

export type FrameworkPreset =
  | 'mintlify'
  | 'docusaurus'
  | 'nextra'
  | 'mkdocs-material'
  | 'vitepress'
  | 'starlight'
  | 'docsy'
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
   *  Defaults:
   *  - `'supabase'`: wraps each event in `{ payload }` (required by Supabase REST API).
   *  - `'http'`: identity (sends the array as-is).
   *  - `'otlp'`: `bodyTransform` is not used (events are emitted via OTel SDK).
   *  Override to customize the payload structure for your collector. */
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
  /** Test-run identifier for integration test isolation. Not for production use. */
  testRunId?: string;
  /** Test framework name for integration test filtering. Not for production use. */
  testFramework?: string;
}

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

export interface Do11yAPI {
  getConfig: () => object;
  flush: () => void;
  isEnabled: () => boolean;
  getQueueSize: () => number;
  version: string;
}

/**
 * Emit function used by all tracking modules.
 * Core tracking captures events and calls emit; the distribution layer
 * decides how to send them (queue+transport or OTel API).
 */
export type EmitFn = (eventName: string, eventData: Record<string, unknown>) => void;

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionData {
  id: string;
  startTime: string;
  pageSequence: Array<{ path: string; timestamp: string; index: number }>;
  pageCount: number;
  referrerCategory: string | null;
  aiPlatform: string | null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface BrowserContext {
  'browser.do11y.viewport_category': string;
  'browser.family': string;
  'device.type': string;
  'browser.language': string;
  'browser.do11y.timezone_offset': number;
}

export interface PageInfo {
  'url.path': string;
  'url.fragment': string | null;
  'url.query': string | null;
  'browser.do11y.page_title': string | null;
}

export interface ReferrerInfo {
  referrerCategory: string;
  aiPlatform: string | null;
}

// ─── Globals ─────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __do11yInitialized?: boolean;
    Do11yConfig?: Partial<Do11yConfig>;
    Do11y?: Do11yAPI;
    doNotTrack?: string;
  }
}
