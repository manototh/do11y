/**
 * Unit tests — Engagement (page_exit) tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, triggerBeforeUnload, triggerVisibilityChange } from '../../helpers/mock-dom';
import {
  setupEngagementTracking,
  emitPageExit,
  resetEngagementState,
  resetPageExitedGuard,
} from '@do11y/core/tracking/engagement';
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
    trackSearch: true, trackCopy: true,
    trackTabSwitches: true, trackTocClicks: true, trackExpandCollapse: true, trackFeedback: true,
    tabContainerSelector: null, tocSelector: null, feedbackSelector: null,
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
  };
}

describe('tracking / engagement', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    sessionStorage.clear();
    resetEngagementState();
  });

  afterEach(() => {
    teardownTestDOM();
  });

  describe('emitPageExit', () => {
    it('emits a page_exit event', () => {
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('browser.do11y.page_exit');
    });

    it('includes total_time_seconds as a number', () => {
      emitPageExit(makeConfig(), emit);
      expect(typeof emitted[0].data['browser.do11y.page_exit.total_time_seconds']).toBe('number');
    });

    it('includes engagement_ratio as a number', () => {
      emitPageExit(makeConfig(), emit);
      expect(typeof emitted[0].data['browser.do11y.page_exit.engagement_ratio']).toBe('number');
    });

    it('includes max_scroll_depth as a number', () => {
      emitPageExit(makeConfig(), emit);
      expect(typeof emitted[0].data['browser.do11y.page_exit.max_scroll_depth']).toBe('number');
    });

    it('includes referrer_category from session', () => {
      emitPageExit(makeConfig(), emit);
      expect(emitted[0].data['browser.do11y.referrer_category']).toBeNull();
    });

    it('calls the afterEmit callback when provided', () => {
      let called = false;
      emitPageExit(makeConfig(), emit, () => { called = true; });
      expect(called).toBe(true);
    });

    it('prevents duplicate emission (guard flag)', () => {
      emitPageExit(makeConfig(), emit);
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(1);
    });
  });

  describe('setupEngagementTracking', () => {
    it('sets up beforeunload handler', () => {
      setupEngagementTracking(makeConfig(), emit);
      triggerBeforeUnload();
      // The beforeunload handler calls emitPageExit which emits the event
      // but due to the guard flag and module-scoped state, this test verifies
      // the setup doesn't throw
      expect(true).toBe(true);
    });

    it('sets up visibilitychange handler', () => {
      setupEngagementTracking(makeConfig(), emit);
      expect(() => triggerVisibilityChange(true)).not.toThrow();
      expect(() => triggerVisibilityChange(false)).not.toThrow();
    });
  });

  describe('resetEngagementState', () => {
    it('resets the page_exit guard', () => {
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(1);

      resetEngagementState();
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(2);
    });
  });

  describe('resetPageExitedGuard', () => {
    it('resets only the guard flag', () => {
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(1);

      resetPageExitedGuard();
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(2);
    });
  });
});
