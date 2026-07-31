/**
 * Unit tests — Shared event rate limiter.
 *
 * Used by both the standalone transport and the OTel instrumentation build.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter, DEFAULT_RATE_LIMIT_MS } from '@do11y/core/rate-limit';
import { ATTR_DO11Y_SCROLL_THRESHOLD } from '@do11y/core/constants';

describe('core / rate-limit', () => {
  it('allows the first event for a name', () => {
    const limiter = createRateLimiter();
    expect(limiter.allow('browser.do11y.page_view', {}, 1000, false)).toBe(true);
  });

  it('blocks a second same-name event within the window', () => {
    const limiter = createRateLimiter();
    limiter.allow('browser.do11y.page_view', {}, 1000, false);
    expect(limiter.allow('browser.do11y.page_view', {}, 1000, false)).toBe(false);
  });

  it('lets distinct scroll thresholds through within the window', () => {
    const limiter = createRateLimiter();
    expect(
      limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 25 }, 1000, false),
    ).toBe(true);
    expect(
      limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 50 }, 1000, false),
    ).toBe(true);
    expect(
      limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 75 }, 1000, false),
    ).toBe(true);
    expect(
      limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 90 }, 1000, false),
    ).toBe(true);
  });

  it('still blocks a duplicate scroll threshold within the window', () => {
    const limiter = createRateLimiter();
    limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 25 }, 1000, false);
    expect(
      limiter.allow('browser.do11y.scroll_depth', { [ATTR_DO11Y_SCROLL_THRESHOLD]: 25 }, 1000, false),
    ).toBe(false);
  });

  it('does not limit when rateLimitMs is 0', () => {
    const limiter = createRateLimiter();
    expect(limiter.allow('browser.do11y.page_view', {}, 0, false)).toBe(true);
    expect(limiter.allow('browser.do11y.page_view', {}, 0, false)).toBe(true);
  });

  it('logs a debug message when dropping an event', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const limiter = createRateLimiter();
      limiter.allow('browser.do11y.page_view', {}, 1000, true);
      limiter.allow('browser.do11y.page_view', {}, 1000, true);
      expect(spy).toHaveBeenCalledWith('[Do11y] Rate limited:', 'browser.do11y.page_view');
    } finally {
      spy.mockRestore();
    }
  });

  it('does not log when debug is false', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const limiter = createRateLimiter();
      limiter.allow('browser.do11y.page_view', {}, 1000, false);
      limiter.allow('browser.do11y.page_view', {}, 1000, false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('reset clears all tracked timestamps', () => {
    const limiter = createRateLimiter();
    limiter.allow('browser.do11y.page_view', {}, 1000, false);
    limiter.reset();
    expect(limiter.allow('browser.do11y.page_view', {}, 1000, false)).toBe(true);
  });

  it('default rate limit is 100ms', () => {
    expect(DEFAULT_RATE_LIMIT_MS).toBe(100);
  });
});
