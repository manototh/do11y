/**
 * Unit tests — Scroll depth tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import { setupScrollTracking, checkScrollDepth, resetTrackedScrollDepths } from '@do11y/core/tracking/scroll';
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
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    ...overrides,
  };
}

describe('tracking / scroll', () => {
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

  describe('checkScrollDepth', () => {
    beforeEach(() => {
      // Reset scroll position and tracked depths before each sub-test
      resetTrackedScrollDepths();
      window.scrollY = 0;
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    });

    it('emits scroll_depth events for each threshold reached', () => {
      // Scroll to 50%
      window.scrollY = 1050; // 1050/(3000-900) ≈ 50%
      checkScrollDepth(makeConfig(), emit);

      // Should emit 25 and 50
      const emittedThresholds = emitted.map(e => e.data['browser.do11y.scroll.threshold']);
      expect(emittedThresholds).toContain(25);
      expect(emittedThresholds).toContain(50);
    });

    it('emits all thresholds when page fits in viewport', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
      window.scrollY = 0;

      checkScrollDepth(makeConfig(), emit);

      const emittedThresholds = emitted.map(e => e.data['browser.do11y.scroll.threshold']);
      expect(emittedThresholds).toEqual([25, 50, 75, 90]);
    });

    it('does not emit duplicate thresholds', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

      window.scrollY = 1050;
      checkScrollDepth(makeConfig(), emit);
      const count1 = emitted.length;

      // Call again at same position — should not emit new events
      checkScrollDepth(makeConfig(), emit);
      expect(emitted.length).toBe(count1);
    });

    it('includes scroll percent in event data', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

      window.scrollY = 1050;
      checkScrollDepth(makeConfig(), emit);

      for (const e of emitted) {
        expect(typeof e.data['browser.do11y.scroll.percent']).toBe('number');
      }
    });
  });

  describe('setupScrollTracking', () => {
    it('calls setupScrollTracking without throwing when tracking is enabled', () => {
      expect(() => {
        setupScrollTracking(makeConfig({ trackScrollDepth: true }), emit);
      }).not.toThrow();
    });

    it('calls setupScrollTracking without throwing when tracking is disabled', () => {
      expect(() => {
        setupScrollTracking(makeConfig({ trackScrollDepth: false }), emit);
      }).not.toThrow();
    });
  });
});
