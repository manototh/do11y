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
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

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
    it('sets up beforeunload handler that emits page_exit', () => {
      setupEngagementTracking(makeConfig(), emit);
      triggerBeforeUnload();
      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('browser.do11y.page_exit');
    });

    it('sets up visibilitychange handler that tracks active time', () => {
      setupEngagementTracking(makeConfig(), emit);
      // Switch to hidden then back to visible — the handler updates active time
      expect(() => triggerVisibilityChange(true)).not.toThrow();
      expect(() => triggerVisibilityChange(false)).not.toThrow();
      // After visibility toggle, emitPageExit should include active time
      emitPageExit(makeConfig(), emit);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].name).toBe('browser.do11y.page_exit');
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
