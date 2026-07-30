/**
 * Unit tests — Tab switch tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupTabSwitchTracking } from '@do11y/core/tracking/tabs';
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

describe('tracking / tabs', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Code Examples</h2>
        <div role="tablist">
          <button role="tab" aria-selected="true">Active Tab</button>
          <button role="tab">Second Tab</button>
          <button role="tab">Third Tab</button>
        </div>
      </body></html>
    `);
    emitted = [];
    setupTabSwitchTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits tab_switch when clicking a non-active tab', () => {
    const tabs = document.querySelectorAll('[role="tab"]');
    clickElement(tabs[1]!); // Click "Second Tab"
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.tab_switch');
    expect(emitted[0].data['browser.do11y.tab.label']).toBe('Second Tab');
  });

  it('does not emit when clicking the already-active tab', () => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]')!;
    clickElement(tab);
    expect(emitted).toHaveLength(0);
  });

  it('identifies the tab group from the nearest heading', () => {
    const tab = document.querySelectorAll('[role="tab"]')[1]!;
    clickElement(tab);
    expect(emitted[0].data['browser.do11y.tab.group']).toBeTruthy();
  });

  it('sets is_default to false for non-active tabs', () => {
    const tab = document.querySelectorAll('[role="tab"]')[1]!;
    clickElement(tab);
    expect(emitted[0].data['browser.do11y.tab.is_default']).toBe(false);
  });
});
