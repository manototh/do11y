/**
 * Unit tests — Standalone transport layer.
 *
 * Tests queueEvent, flush, flushSync, retry logic, body transforms,
 * config validation, and OTel SDK initialization.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../helpers/mock-dom';
import { mockFetch, restoreFetch, getRequests, setDefaultResponse, setMockResponse, setMockError, clearRequests } from '../helpers/mock-fetch';
import type { Do11yConfig } from '@do11y/core/types';

// The transport module uses module-level state (eventQueue, flushTimeout, etc.)
// We import the functions directly and manage state via reset helpers.
import {
  queueEvent,
  flush,
  flushSync,
  validateConfig,
  setIsDisabled,
  getIsDisabled,
  getQueueLength,
  cleanup,
  resetTransportState,
} from '@do11y/standalone/transport';

function makeSupabaseConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
  return {
    destination: 'supabase',
    supabaseUrl: 'https://test-project.supabase.co',
    supabaseKey: 'sb-publishable-key-12345',
    supabaseTable: 'do11y_events',
    endpoint: '',
    headers: {},
    bodyTransform: undefined,
    otelSdkEndpoint: '',
    otelSdkHeaders: {},
    otelSdkServiceName: 'do11y',
    otelSdkResourceAttributes: {},
    otelSdkCdnUrl: 'https://esm.sh/',
    debug: false,
    flushInterval: 5000,
    maxBatchSize: 10,
    trackOutboundLinks: true,
    trackInternalLinks: true,
    trackScrollDepth: true,
    scrollThresholds: [25, 50, 75, 90],
    allowedDomains: null,
    respectDNT: true,
    maxRetries: 2,
    retryDelay: 10, // short for tests
    rateLimitMs: 0, // disable rate limiting for tests
    framework: 'mintlify',
    trackSectionVisibility: true,
    sectionVisibleThreshold: 3,
    trackTabSwitches: true,
    trackTocClicks: true,
    trackExpandCollapse: true,
    trackFeedback: true,
    tabContainerSelector: null,
    tocSelector: null,
    feedbackSelector: null,
    searchSelector: null,
    copyButtonSelector: null,
    codeBlockSelector: null,
    navigationSelector: null,
    footerSelector: null,
    contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
    ...overrides,
  };
}

function makeHttpConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
  return makeSupabaseConfig({
    destination: 'http',
    endpoint: 'https://collector.example.com/v1/events',
    supabaseUrl: '',
    supabaseKey: '',
    ...overrides,
  });
}

describe('transport', () => {
  beforeEach(() => {
    setupTestDOM();
    mockFetch();
    setDefaultResponse(200, {});
    clearRequests();
    resetTransportState();
    setIsDisabled(false);
  });

  afterEach(() => {
    cleanup();
    restoreFetch();
    teardownTestDOM();
  });

  describe('queueEvent', () => {
    beforeEach(() => {
      cleanup();
      clearRequests();
    });

    it('queues an event with required metadata', () => {
      queueEvent(makeSupabaseConfig(), 'browser.do11y.page_view', { foo: 'bar' });
      expect(getQueueLength()).toBe(1);
    });

    it('does not queue events when disabled', () => {
      setIsDisabled(true);
      queueEvent(makeSupabaseConfig(), 'browser.do11y.page_view', {});
      expect(getQueueLength()).toBe(0);
    });

    it('caps queue at 100 events', () => {
      const config = makeSupabaseConfig({ maxBatchSize: 200 });
      for (let i = 0; i < 150; i++) {
        queueEvent(config, 'browser.do11y.page_view', { idx: i });
      }
      expect(getQueueLength()).toBeLessThanOrEqual(100);
    });

    it('respects rate limiting when enabled', () => {
      const config = makeSupabaseConfig({ rateLimitMs: 1000 });
      const uniqueEvent = 'browser.do11y.test_rate_limit_' + Date.now();
      queueEvent(config, uniqueEvent, {});
      queueEvent(config, uniqueEvent, {});
      expect(getQueueLength()).toBe(1);
    });

    it('auto-flushes when queue exceeds maxBatchSize', () => {
      cleanup();
      clearRequests();
      const config = makeSupabaseConfig({ maxBatchSize: 3, flushInterval: 60000 });
      queueEvent(config, 'browser.do11y.page_view', { n: 1 });
      queueEvent(config, 'browser.do11y.page_view', { n: 2 });
      expect(getRequests().length).toBe(0);
      queueEvent(config, 'browser.do11y.page_view', { n: 3 });
      // flush should have been called; at minimum no crash
      expect(getQueueLength()).toBeLessThan(3);
    });

    it('injects eventName and version into each event (HTTP destination)', () => {
      cleanup();
      clearRequests();
      const config = makeHttpConfig();
      queueEvent(config, 'browser.do11y.test_event', {});
      flush(config);
      const reqs = getRequests();
      expect(reqs.length).toBeGreaterThan(0);
      const body = reqs[0]!.body as Array<Record<string, unknown>>;
      expect(body[0]!.eventName).toBe('browser.do11y.test_event');
      expect(body[0]!['browser.do11y.version']).toBe('0.2.0');
    });
  });

  describe('flush', () => {
    beforeEach(() => {
      cleanup();
      clearRequests();
    });

    it('sends events via fetch to Supabase endpoint', () => {
      const config = makeSupabaseConfig();
      queueEvent(config, 'browser.do11y.page_view', {});
      flush(config);

      const reqs = getRequests();
      expect(reqs.length).toBe(1);
      expect(reqs[0]!.url).toContain('test-project.supabase.co');
      expect(reqs[0]!.method).toBe('POST');
    });

    it('sends events via fetch to HTTP endpoint', () => {
      const config = makeHttpConfig();
      queueEvent(config, 'browser.do11y.page_view', {});
      flush(config);

      const reqs = getRequests();
      expect(reqs.length).toBe(1);
      expect(reqs[0]!.url).toBe('https://collector.example.com/v1/events');
    });

    it('uses Supabase body transform ({payload: event})', () => {
      const config = makeSupabaseConfig();
      queueEvent(config, 'browser.do11y.page_view', { key: 'val' });
      flush(config);

      const reqs = getRequests();
      const body = reqs[0]!.body as Array<Record<string, unknown>>;
      expect(Array.isArray(body)).toBe(true);
      // Supabase transform wraps each event in { payload: event }
      expect(body[0]!).toHaveProperty('payload');
      expect((body[0]! as any).payload.eventName).toBe('browser.do11y.page_view');
    });

    it('uses identity body transform for HTTP destination', () => {
      const config = makeHttpConfig();
      queueEvent(config, 'browser.do11y.page_view', { key: 'val' });
      flush(config);

      const reqs = getRequests();
      const body = reqs[0]!.body as Array<Record<string, unknown>>;
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]!).not.toHaveProperty('payload');
      expect(body[0]!).toHaveProperty('eventName');
    });

    it('does nothing when queue is empty', () => {
      flush(makeSupabaseConfig());
      expect(getRequests().length).toBe(0);
    });

    it('includes required Supabase headers', () => {
      const config = makeSupabaseConfig();
      queueEvent(config, 'browser.do11y.page_view', {});
      flush(config);

      const reqs = getRequests();
      expect(reqs[0]!.headers['apikey']).toBe('sb-publishable-key-12345');
      expect(reqs[0]!.headers['Authorization']).toBe('Bearer sb-publishable-key-12345');
      expect(reqs[0]!.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('flushSync', () => {
    beforeEach(() => {
      cleanup();
      clearRequests();
    });

    it('sends events synchronously on page unload', () => {
      const config = makeSupabaseConfig();
      queueEvent(config, 'browser.do11y.page_view', {});
      flushSync(config);

      const reqs = getRequests();
      expect(reqs.length).toBe(1);
    });

    it('does nothing when queue is empty', () => {
      flushSync(makeSupabaseConfig());
      expect(getRequests().length).toBe(0);
    });
  });

  describe('validateConfig', () => {
    it('returns true for valid Supabase config', () => {
      expect(validateConfig(makeSupabaseConfig())).toBe(true);
    });

    it('returns true for valid HTTP config', () => {
      expect(validateConfig(makeHttpConfig())).toBe(true);
    });

    it('returns false for Supabase config without URL', () => {
      expect(validateConfig(makeSupabaseConfig({ supabaseUrl: '' }))).toBe(false);
    });

    it('returns false for Supabase config without key', () => {
      expect(validateConfig(makeSupabaseConfig({ supabaseKey: '' }))).toBe(false);
    });

    it('returns false for invalid Supabase URL', () => {
      expect(validateConfig(makeSupabaseConfig({ supabaseUrl: 'https://evil.com' }))).toBe(false);
    });

    it('returns false for HTTP config with private address', () => {
      expect(validateConfig(makeHttpConfig({ endpoint: 'http://localhost:8080' }))).toBe(false);
    });

    it('returns false for HTTP config without endpoint', () => {
      expect(validateConfig(makeHttpConfig({ endpoint: '' }))).toBe(false);
    });

    it('returns true for OTLP config with endpoint', () => {
      expect(validateConfig(makeSupabaseConfig({
        destination: 'otlp',
        otelSdkEndpoint: 'https://otel.example.com',
      }))).toBe(true);
    });
  });

  describe('setIsDisabled / getIsDisabled', () => {
    it('defaults to false', () => {
      expect(getIsDisabled()).toBe(false);
    });

    it('returns true after setIsDisabled(true)', () => {
      setIsDisabled(true);
      expect(getIsDisabled()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('does not throw', () => {
      expect(() => cleanup()).not.toThrow();
    });

    it('can be called multiple times', () => {
      cleanup();
      cleanup();
    });
  });
});
