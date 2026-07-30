/**
 * Unit tests — Search tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement, pressKey } from '../../helpers/mock-dom';
import { setupSearchTracking } from '@do11y/core/tracking/search';
import type { Do11yConfig, EmitFn } from '@do11y/core/types';

function makeConfig(): Do11yConfig {
  return {
    destination: 'http', supabaseUrl: '', supabaseKey: '', supabaseTable: 'do11y_events',
    endpoint: '', headers: {}, bodyTransform: undefined,
    otelSdkEndpoint: '', otelSdkHeaders: {}, otelSdkServiceName: '', otelSdkResourceAttributes: {}, otelSdkCdnUrl: '',
    debug: false, flushInterval: 5000, maxBatchSize: 10,
    trackOutboundLinks: true, trackInternalLinks: true, trackScrollDepth: true,
    scrollThresholds: [25, 50, 75, 90], allowedDomains: null, respectDNT: true,
    maxRetries: 2, retryDelay: 1000, rateLimitMs: 100,
    framework: 'mintlify', trackSectionVisibility: true, sectionVisibleThreshold: 3,
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: '.search-input, #search-bar-entry, .DocSearch-Button',
    copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
  };
}

describe('tracking / search', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    setupSearchTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits search_opened when clicking a search element', () => {
    const searchBtn = document.querySelector('.search-input') as HTMLElement;
    expect(searchBtn).toBeTruthy();
    clickElement(searchBtn);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.search_opened');
  });

  it('emits search_opened on Cmd+K', () => {
    pressKey('k', document.body, { metaKey: true });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.search_opened');
    expect(emitted[0].data['browser.do11y.search.trigger']).toBe('keyboard');
  });

  it('emits search_opened on Ctrl+K', () => {
    pressKey('k', document.body, { ctrlKey: true });
    expect(emitted).toHaveLength(1);
  });

  it('does not emit for non-search clicks', () => {
    clickElement(document.body);
    expect(emitted).toHaveLength(0);
  });
});
