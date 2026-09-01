/**
 * Unit tests — Browser context and referrer classification.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  categorizeViewport,
  getBrowserFamily,
  getDeviceType,
  getBrowserContext,
  classifyReferrer,
  getReferrerDomain,
  getPageInfo,
  AI_REFERRER_PATTERNS,
} from '@do11y/core/context';

describe('context', () => {
  beforeEach(() => {
    setupTestDOM();
  });

  afterEach(() => {
    teardownTestDOM();
  });

  describe('categorizeViewport', () => {
    it('returns "mobile" for viewports < 640px', () => {
      (window as any).innerWidth = 375;
      expect(categorizeViewport()).toBe('mobile');
    });

    it('returns "tablet" for viewports 640-1023px', () => {
      (window as any).innerWidth = 768;
      expect(categorizeViewport()).toBe('tablet');
    });

    it('returns "desktop" for viewports 1024-1439px', () => {
      (window as any).innerWidth = 1280;
      expect(categorizeViewport()).toBe('desktop');
    });

    it('returns "large-desktop" for viewports >= 1440px', () => {
      (window as any).innerWidth = 1920;
      expect(categorizeViewport()).toBe('large-desktop');
    });
  });

  describe('getBrowserFamily', () => {
    it('detects Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      expect(getBrowserFamily()).toBe('Chrome');
    });

    it('detects Firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Firefox/120.0',
        configurable: true,
      });
      expect(getBrowserFamily()).toBe('Firefox');
    });

    it('detects Edge', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Edg/120.0',
        configurable: true,
      });
      expect(getBrowserFamily()).toBe('Edge');
    });

    it('detects Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Safari/605.1.15',
        configurable: true,
      });
      expect(getBrowserFamily()).toBe('Safari');
    });

    it('returns "Other" for unknown browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'SomeUnknownBrowser/1.0',
        configurable: true,
      });
      expect(getBrowserFamily()).toBe('Other');
    });
  });

  describe('getDeviceType', () => {
    it('returns "mobile" for iPhone UA', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 iPhone; CPU iPhone OS',
        configurable: true,
      });
      expect(getDeviceType()).toBe('mobile');
    });

    it('returns "tablet" for iPad UA', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 iPad; CPU OS',
        configurable: true,
      });
      expect(getDeviceType()).toBe('tablet');
    });

    it('returns "desktop" for desktop UA', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Windows NT 10.0',
        configurable: true,
      });
      expect(getDeviceType()).toBe('desktop');
    });
  });

  describe('getBrowserContext', () => {
    it('returns all required fields', () => {
      const ctx = getBrowserContext();
      expect(ctx['browser.do11y.viewport_category']).toBeTruthy();
      expect(ctx['browser.family']).toBeTruthy();
      expect(ctx['device.type']).toBeTruthy();
      expect(ctx['browser.language']).toBeTruthy();
      expect(typeof ctx['browser.do11y.timezone_offset']).toBe('number');
    });
  });

  describe('classifyReferrer', () => {
    it('classifies direct traffic', () => {
      const result = classifyReferrer('direct');
      expect(result.referrerCategory).toBe('direct');
      expect(result.aiPlatform).toBeNull();
    });

    it('classifies internal traffic', () => {
      const result = classifyReferrer('internal');
      expect(result.referrerCategory).toBe('internal');
    });

    it('classifies unknown referrer', () => {
      const result = classifyReferrer('unknown');
      expect(result.referrerCategory).toBe('unknown');
    });

    it('classifies ChatGPT', () => {
      const result = classifyReferrer('chatgpt.com');
      expect(result.referrerCategory).toBe('ai');
      expect(result.aiPlatform).toBe('ChatGPT');
    });

    it('classifies chat.openai.com as ChatGPT', () => {
      const result = classifyReferrer('chat.openai.com');
      expect(result.referrerCategory).toBe('ai');
      expect(result.aiPlatform).toBe('ChatGPT');
    });

    it('classifies Claude', () => {
      const result = classifyReferrer('claude.ai');
      expect(result.referrerCategory).toBe('ai');
      expect(result.aiPlatform).toBe('Claude');
    });

    it('classifies Perplexity', () => {
      const result = classifyReferrer('www.perplexity.ai');
      expect(result.referrerCategory).toBe('ai');
      expect(result.aiPlatform).toBe('Perplexity');
    });

    it('classifies Google search', () => {
      const result = classifyReferrer('www.google.com');
      expect(result.referrerCategory).toBe('search-engine');
      expect(result.aiPlatform).toBeNull();
    });

    it('classifies GitHub', () => {
      const result = classifyReferrer('github.com');
      expect(result.referrerCategory).toBe('code-host');
    });

    it('classifies Reddit as community', () => {
      const result = classifyReferrer('www.reddit.com');
      expect(result.referrerCategory).toBe('community');
    });

    it('classifies Twitter as social', () => {
      const result = classifyReferrer('twitter.com');
      expect(result.referrerCategory).toBe('social');
    });

    it('returns "other" for unknown referrers', () => {
      const result = classifyReferrer('some-random-blog.example.com');
      expect(result.referrerCategory).toBe('other');
    });

    it('is case-insensitive', () => {
      const result = classifyReferrer('CHATGPT.COM');
      expect(result.referrerCategory).toBe('ai');
      expect(result.aiPlatform).toBe('ChatGPT');
    });

    it('matches all AI platforms in readonly patterns', () => {
      const platforms = AI_REFERRER_PATTERNS.map(p => p.platform);
      const uniquePlatforms = new Set(platforms);
      // Some platforms (ChatGPT, Claude, Grok) appear in multiple match patterns
      expect(platforms.length).toBeGreaterThanOrEqual(uniquePlatforms.size);
      expect(uniquePlatforms).toContain('ChatGPT');
      expect(uniquePlatforms).toContain('Claude');
      expect(uniquePlatforms).toContain('Perplexity');
      expect(uniquePlatforms).toContain('Gemini');
      expect(uniquePlatforms).toContain('Copilot');
      expect(uniquePlatforms).toContain('DeepSeek');
      expect(uniquePlatforms).toContain('Meta AI');
      expect(uniquePlatforms).toContain('Grok');
      expect(uniquePlatforms).toContain('Mistral');
      expect(uniquePlatforms).toContain('You.com');
      expect(uniquePlatforms).toContain('Phind');
      expect(uniquePlatforms.size).toBe(11);
    });
  });

  describe('getReferrerDomain', () => {
    it('returns "direct" when there is no referrer', () => {
      Object.defineProperty(document, 'referrer', { value: '', configurable: true });
      expect(getReferrerDomain()).toBe('direct');
    });

    it('returns "internal" when referrer matches location hostname', () => {
      Object.defineProperty(document, 'referrer', {
        value: 'http://localhost:4001/guide',
        configurable: true,
      });
      expect(getReferrerDomain()).toBe('internal');
    });

    it('returns the hostname for external referrers', () => {
      Object.defineProperty(document, 'referrer', {
        value: 'https://www.google.com/search?q=do11y',
        configurable: true,
      });
      expect(getReferrerDomain()).toBe('www.google.com');
    });

    it('returns "unknown" for invalid referrer URLs', () => {
      Object.defineProperty(document, 'referrer', {
        value: 'not-a-valid-url',
        configurable: true,
      });
      expect(getReferrerDomain()).toBe('unknown');
    });
  });

  describe('getPageInfo', () => {
    it('returns path, fragment, query, and title', () => {
      Object.defineProperty(document, 'title', {
        value: 'Test Documentation',
        configurable: true,
      });
      const info = getPageInfo();
      expect(info['url.path']).toBe('/');
      expect('url.fragment' in info).toBe(true);
      expect('browser.do11y.url.has_params' in info).toBe(true);
      expect(info['browser.do11y.page_title']).toBe('Test Documentation');
    });
  });
});
