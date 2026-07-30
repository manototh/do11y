/**
 * Unit tests — Feedback tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupFeedbackTracking } from '@do11y/core/tracking/feedback';
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
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
    ...overrides,
  };
}

describe('tracking / feedback', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <div class="feedback">
          <p>Was this page helpful?</p>
          <button class="feedback-yes" aria-label="Yes">👍 Yes</button>
          <button class="feedback-no" aria-label="No">👎 No</button>
        </div>
        <div class="feedback" data-feedback="rating">
          <button data-value="helpful">Helpful</button>
          <button data-value="not-helpful">Not Helpful</button>
        </div>
      </body></html>
    `);
    emitted = [];
    setupFeedbackTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits feedback with rating "yes" for thumbs-up', () => {
    const yesBtn = document.querySelector('.feedback-yes')!;
    clickElement(yesBtn);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.feedback');
    expect(emitted[0].data['browser.do11y.feedback.rating']).toBe('yes');
  });

  it('emits feedback with rating "no" for thumbs-down', () => {
    const noBtn = document.querySelector('.feedback-no')!;
    clickElement(noBtn);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].data['browser.do11y.feedback.rating']).toBe('no');
  });

  it('reads rating from data-value attribute when available', () => {
    const helpfulBtn = document.querySelector('[data-value="helpful"]')!;
    clickElement(helpfulBtn);
    expect(emitted[0].data['browser.do11y.feedback.rating']).toBe('helpful');
  });

  it('does not emit for clicks outside feedback containers', () => {
    clickElement(document.body);
    expect(emitted).toHaveLength(0);
  });

  it('respects trackFeedback=false', () => {
    teardownTestDOM();
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <div class="feedback">
          <button class="feedback-yes" aria-label="Yes">👍 Yes</button>
        </div>
      </body></html>
    `);
    emitted = [];
    setupFeedbackTracking(makeConfig({ trackFeedback: false }), emit);
    const yesBtn = document.querySelector('.feedback-yes')!;
    clickElement(yesBtn);
    expect(emitted).toHaveLength(0);
  });
});
