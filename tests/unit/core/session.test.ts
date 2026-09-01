/**
 * Unit tests — Session management.
 *
 * Tests session ID generation, storage, page sequence tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  getSession,
  saveSession,
  updatePageSequence,
} from '@do11y/core/session';

describe('session', () => {
  beforeEach(() => {
    setupTestDOM();
    sessionStorage.removeItem('do11y_session');
  });

  afterEach(() => {
    teardownTestDOM();
  });

  describe('getSession', () => {
    it('creates a new session when none exists', () => {
      const session = getSession();
      expect(session.id).toBeTruthy();
      expect(typeof session.id).toBe('string');
      expect(session.startTime).toBeTruthy();
      expect(session.pageSequence).toEqual([]);
      expect(session.pageCount).toBe(0);
      expect(session.referrerCategory).toBeNull();
      expect(session.aiPlatform).toBeNull();
    });

    it('returns the same session on subsequent calls', () => {
      const first = getSession();
      const second = getSession();
      expect(second.id).toBe(first.id);
    });

    it('persists session across calls (within same sessionStorage)', () => {
      const first = getSession();
      const stored = JSON.parse(sessionStorage.getItem('do11y_session')!);
      expect(stored.id).toBe(first.id);

      const second = getSession();
      expect(second.id).toBe(first.id);
    });

    it('generates a UUID-like session ID', () => {
      const session = getSession();
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('updatePageSequence', () => {
    it('increments pageCount', () => {
      updatePageSequence('/');
      const session = getSession();
      expect(session.pageCount).toBe(1);
    });

    it('records the path in pageSequence', () => {
      updatePageSequence('/docs/getting-started');
      const session = getSession();
      expect(session.pageSequence).toHaveLength(1);
      expect(session.pageSequence[0].path).toBe('/docs/getting-started');
      expect(session.pageSequence[0].index).toBe(1);
    });

    it('tracks multiple pages in order', () => {
      updatePageSequence('/');
      updatePageSequence('/guide');
      updatePageSequence('/api');

      const session = getSession();
      expect(session.pageCount).toBe(3);
      expect(session.pageSequence.map(p => p.path)).toEqual(['/', '/guide', '/api']);
      expect(session.pageSequence.map(p => p.index)).toEqual([1, 2, 3]);
    });

    it('caps pageSequence at 50 entries', () => {
      for (let i = 0; i < 55; i++) {
        updatePageSequence(`/page-${i}`);
      }
      const session = getSession();
      expect(session.pageSequence).toHaveLength(50);
      expect(session.pageSequence[0].path).toBe('/page-5');
      expect(session.pageSequence[49].path).toBe('/page-54');
    });
  });

  describe('saveSession', () => {
    it('persists updated session data to sessionStorage', () => {
      const session = getSession();
      session.pageCount = 42;
      saveSession(session);

      const stored = JSON.parse(sessionStorage.getItem('do11y_session')!);
      expect(stored.pageCount).toBe(42);
    });
  });

  describe('session ID generation (crypto)', () => {
    it('generates unique IDs across sessions', () => {
      sessionStorage.removeItem('do11y_session');
      const first = getSession();

      sessionStorage.removeItem('do11y_session');
      const second = getSession();

      expect(second.id).not.toBe(first.id);
    });

    it('handles missing crypto.randomUUID by falling back to getRandomValues', () => {
      const realRandomUUID = window.crypto.randomUUID;
      (window.crypto as any).randomUUID = undefined;

      sessionStorage.removeItem('do11y_session');
      const session = getSession();
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      window.crypto.randomUUID = realRandomUUID;
    });
  });
});
