/**
 * Unit tests — Expand/collapse tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupExpandCollapseTracking } from '@do11y/core/tracking/expand';
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

describe('tracking / expand', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Advanced Options</h2>
        <details>
          <summary>Click to expand</summary>
          <p>Hidden content</p>
        </details>
        <details>
          <summary>Another section</summary>
          <p>More hidden content</p>
        </details>
      </body></html>
    `);
    emitted = [];
    setupExpandCollapseTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits expand_collapse when toggling a details element', () => {
    const details = document.querySelector('details')!;
    // Simulate toggle event
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.expand_collapse');
    expect(emitted[0].data['browser.do11y.expand.action']).toBe('expand');
  });

  it('includes the summary text', () => {
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted[0].data['browser.do11y.expand.summary']).toBe('Click to expand');
  });

  it('includes the section heading', () => {
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted[0].data['browser.do11y.expand.section']).toBe('Advanced Options');
  });

  it('respects trackExpandCollapse=false', () => {
    teardownTestDOM();
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Section</h2>
        <details>
          <summary>Click to expand</summary>
          <p>Hidden content</p>
        </details>
      </body></html>
    `);
    emitted = [];
    setupExpandCollapseTracking(makeConfig({ trackExpandCollapse: false }), emit);
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted).toHaveLength(0);
  });
});
