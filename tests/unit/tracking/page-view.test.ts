/**
 * Unit tests — Page view tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import { trackPageView } from '@do11y/core/tracking/page-view';
import type { Do11yConfig, EmitFn } from '@do11y/core/types';

function makeConfig(): Do11yConfig {
  return {
    destination: 'http', supabaseUrl: '', supabaseKey: '', supabaseTable: 'do11y_events',
    endpoint: '', headers: {}, bodyTransform: undefined,
    otelSdkEndpoint: '', otelSdkHeaders: {}, otelSdkServiceName: '', otelSdkResourceAttributes: {},
    debug: false, flushInterval: 5000, maxBatchSize: 10,
    trackOutboundLinks: true, trackInternalLinks: true, trackScrollDepth: true,
    scrollThresholds: [25, 50, 75, 90], allowedDomains: null, respectDNT: true,
    maxRetries: 2, retryDelay: 1000, rateLimitMs: 100,
    framework: 'mintlify', trackSectionVisibility: true, sectionVisibleThreshold: 3,
    trackSearch: true, trackCopy: true,
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
  };
}

describe('tracking / page-view', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    sessionStorage.clear();
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits a page_view event with referrer info', () => {
    trackPageView(makeConfig(), emit);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.page_view');
    expect(emitted[0].data['browser.do11y.referrer_domain']).toBe('direct');
    expect(emitted[0].data['browser.do11y.is_first_page']).toBe(true);
  });

  it('sets is_first_page to true on first call', () => {
    trackPageView(makeConfig(), emit);
    expect(emitted[0].data['browser.do11y.is_first_page']).toBe(true);
  });

  it('sets is_first_page to false on subsequent calls', () => {
    trackPageView(makeConfig(), emit);
    emitted = [];
    trackPageView(makeConfig(), emit);
    expect(emitted[0].data['browser.do11y.is_first_page']).toBe(false);
  });

  it('includes previous_path on subsequent page views', () => {
    trackPageView(makeConfig(), emit);
    emitted = [];
    trackPageView(makeConfig(), emit);
    expect(emitted[0].data['browser.do11y.previous_path']).toBe('/');
  });

  it('stores referrer info in session on first page', () => {
    trackPageView(makeConfig(), emit);
    const session = JSON.parse(sessionStorage.getItem('do11y_session')!);
    expect(session.referrerCategory).toBe('direct');
  });
});
