/**
 * Unit tests — Code copy tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupCopyTracking } from '@do11y/core/tracking/copy';
import type { Do11yConfig, EmitFn } from '@do11y/core/types';

function makeConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
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
    searchSelector: null, copyButtonSelector: 'button[class*="copy"], button[aria-label*="copy" i]', codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
    ...overrides,
  };
}

describe('tracking / copy', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    setupCopyTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits code_copied when clicking a copy button', () => {
    const copyBtn = document.querySelector('.copy-button') as HTMLElement;
    expect(copyBtn).toBeTruthy();
    clickElement(copyBtn);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.code_copied');
  });

  it('includes the code language', () => {
    clickElement(document.querySelector('.copy-button')!);
    expect(emitted[0].data['browser.do11y.code.language']).toBe('bash');
  });

  it('includes the code block index', () => {
    clickElement(document.querySelector('.copy-button')!);
    expect(emitted[0].data['browser.do11y.code.index']).toBe(1);
  });

  it('includes the section heading', () => {
    clickElement(document.querySelector('.copy-button')!);
    expect(emitted[0].data['browser.do11y.code.section']).toBeTruthy();
  });

  it('does not emit for non-copy-button clicks', () => {
    clickElement(document.body);
    expect(emitted).toHaveLength(0);
  });
});
