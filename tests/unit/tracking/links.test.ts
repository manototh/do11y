/**
 * Unit tests — Link click tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupLinkTracking } from '@do11y/core/tracking/links';
import type { Do11yConfig, EmitFn } from '@do11y/core/types';

function makeConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
  return {
    destination: 'http', supabaseUrl: '', supabaseKey: '', supabaseTable: 'do11y_events',
    endpoint: '', headers: {}, bodyTransform: undefined,
    otelSdkEndpoint: '', otelSdkHeaders: {}, otelSdkServiceName: '', otelSdkResourceAttributes: {}, otelSdkCdnUrl: '',
    debug: false, flushInterval: 5000, maxBatchSize: 10,
    trackOutboundLinks: true, trackInternalLinks: true, trackScrollDepth: true,
    scrollThresholds: [25, 50, 75, 90], allowedDomains: null, respectDNT: true,
    maxRetries: 2, retryDelay: 1000, rateLimitMs: 100,
    framework: 'mintlify', trackSectionVisibility: true, sectionVisibleThreshold: 3,
    trackSearch: true, trackCopy: true,
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: '.search-input', copyButtonSelector: '.copy-button', codeBlockSelector: 'pre',
    navigationSelector: 'nav, #navbar', footerSelector: 'footer',
    contentSelector: 'main, article',
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
    ...overrides,
  };
}

describe('tracking / links', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    sessionStorage.clear();
    setupLinkTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits link_click for internal links', () => {
    const link = document.querySelector('a[href="/guide"]')!;
    clickElement(link);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.link_click');
    expect(emitted[0].data['browser.do11y.link.type']).toBe('internal');
    expect(emitted[0].data['browser.do11y.link.target_url']).toBe('/guide');
  });

  it('classifies links in navigation context', () => {
    const link = document.querySelector('nav a')!;
    clickElement(link);
    expect(emitted[0].data['browser.do11y.link.context']).toBe('navigation');
  });

  it('classifies links in content context', () => {
    const link = document.createElement('a');
    link.href = '/docs';
    link.textContent = 'Docs';
    const main = document.querySelector('main')!;
    main.appendChild(link);
    clickElement(link);
    expect(emitted[0].data['browser.do11y.link.context']).toBe('content');
  });

  it('classifies external links', () => {
    const link = document.querySelector('footer a')!;
    clickElement(link);
    expect(emitted[0].data['browser.do11y.link.type']).toBe('external');
    expect(emitted[0].data['browser.do11y.link.target_url']).toBe('https://example.com/privacy');
    expect(emitted[0].data['browser.do11y.link.target_domain']).toBe('example.com');
  });

  it('classifies anchor links', () => {
    const link = document.createElement('a');
    link.href = '#section';
    link.textContent = 'Jump to section';
    document.body.appendChild(link);
    clickElement(link);
    expect(emitted[0].data['browser.do11y.link.type']).toBe('anchor');
  });

  it('does not emit for non-link elements', () => {
    const button = document.createElement('button');
    button.textContent = 'Click me';
    document.body.appendChild(button);
    clickElement(button);
    expect(emitted).toHaveLength(0);
  });

  it('respects trackInternalLinks=false', () => {
    // Fresh setup — override any stale listeners from beforeEach
    teardownTestDOM();
    setupTestDOM();
    emitted = [];
    setupLinkTracking(makeConfig({ trackInternalLinks: false }), emit);
    const link = document.querySelector('a[href="/guide"]')!;
    clickElement(link);
    expect(emitted).toHaveLength(0);
  });

  it('respects trackOutboundLinks=false', () => {
    teardownTestDOM();
    setupTestDOM();
    emitted = [];
    setupLinkTracking(makeConfig({ trackOutboundLinks: false }), emit);
    const link = document.querySelector('footer a')!;
    clickElement(link);
    expect(emitted).toHaveLength(0);
  });

  it('includes link text in event', () => {
    const link = document.querySelector('a[href="/guide"]')!;
    clickElement(link);
    expect(emitted[0].data['browser.do11y.link.text']).toBe('Guide');
  });
});
