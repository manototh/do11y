/**
 * Unit tests — Section visibility tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  setupSectionVisibilityTracking,
  observeHeadings,
  flushVisibleSections,
  disconnectSectionObserver,
} from '@do11y/core/tracking/sections';
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
    framework: 'mintlify', trackSectionVisibility: true, sectionVisibleThreshold: 0, // 0 = fire immediately
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
  };
}

describe('tracking / sections', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Getting Started</h2>
        <p>Content here</p>
        <h2>Installation</h2>
        <p>More content</p>
        <h3>Prerequisites</h3>
        <p>Details</p>
      </body></html>
    `);
    emitted = [];
  });

  afterEach(() => {
    disconnectSectionObserver();
    teardownTestDOM();
  });

  it('observes h2 and h3 elements', () => {
    setupSectionVisibilityTracking(makeConfig(), emit);
    const headings = document.querySelectorAll('[data-do11y-section-id]');
    expect(headings.length).toBe(3); // h2, h2, h3
  });

  it('calls observeHeadings without throwing', () => {
    setupSectionVisibilityTracking(makeConfig(), emit);
    expect(() => observeHeadings()).not.toThrow();
  });

  it('flushVisibleSections does not throw when called', () => {
    setupSectionVisibilityTracking(makeConfig(), emit);
    expect(() => flushVisibleSections(makeConfig(), emit)).not.toThrow();
  });

  it('disconnectSectionObserver cleans up', () => {
    setupSectionVisibilityTracking(makeConfig(), emit);
    disconnectSectionObserver();
    // Calling disconnect again should be safe
    disconnectSectionObserver();
  });
});
