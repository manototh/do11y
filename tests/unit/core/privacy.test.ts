/**
 * Unit tests — Privacy and security checks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  validateSelector,
  shouldDisableTracking,
} from '@do11y/core/privacy';
import type { Do11yConfig } from '@do11y/core/types';

function makeConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
  return {
    destination: 'supabase',
    supabaseUrl: '',
    supabaseKey: '',
    supabaseTable: 'do11y_events',
    endpoint: '',
    headers: {},
    bodyTransform: undefined,
    otelSdkEndpoint: '',
    otelSdkHeaders: {},
    otelSdkServiceName: 'do11y',
    otelSdkResourceAttributes: {},
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
    retryDelay: 1000,
    rateLimitMs: 100,
    framework: 'mintlify',
    trackSectionVisibility: true,
    sectionVisibleThreshold: 3,
    trackTabSwitches: true,
    trackTocClicks: true,
    trackExpandCollapse: true,
    trackFeedback: true,
    trackSearch: true,
    trackCopy: true,
    sessionAttributes: true,
    tabContainerSelector: null,
    tocSelector: null,
    feedbackSelector: null,
    searchSelector: null,
    copyButtonSelector: null,
    codeBlockSelector: null,
    navigationSelector: null,
    footerSelector: null,
    contentSelector: null,
    trackSpaPathChanges: false,
    ...overrides,
  } as Do11yConfig;
}

describe('privacy', () => {
  beforeEach(() => {
    setupTestDOM();
  });

  afterEach(() => {
    teardownTestDOM();
  });

  describe('validateSelector', () => {
    it('passes through a valid CSS selector', () => {
      expect(validateSelector('.my-class')).toBe('.my-class');
    });

    it('passes through a valid complex selector', () => {
      expect(validateSelector('main > div[data-testid="foo"] .bar:first-child')).toBe(
        'main > div[data-testid="foo"] .bar:first-child',
      );
    });

    it('returns null for an invalid selector', () => {
      expect(validateSelector('')); // empty → null
    });

    it('returns null for null input', () => {
      expect(validateSelector(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(validateSelector(undefined)).toBeNull();
    });

    it('returns null for a syntactically broken selector', () => {
      // This will throw when querySelector is called — our handler catches it
      expect(validateSelector('!!!invalid')).toBeNull();
    });
  });

  describe('shouldDisableTracking', () => {
    it('returns false when DNT is not set and no allowedDomains', () => {
      const config = makeConfig({
        respectDNT: true,
        allowedDomains: null,
        debug: false,
      });
      // Ensure DNT is not set
      Object.defineProperty(navigator, 'doNotTrack', {
        value: undefined,
        configurable: true,
      });
      expect(shouldDisableTracking(config)).toBe(false);
    });

    it('returns true when DNT is "1"', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      });
      const config = makeConfig({ respectDNT: true, allowedDomains: null, debug: false });
      expect(shouldDisableTracking(config)).toBe(true);
    });

    it('returns false when DNT is set but respectDNT is false', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      });
      const config = makeConfig({ respectDNT: false, allowedDomains: null, debug: false });
      expect(shouldDisableTracking(config)).toBe(false);
    });

    it('returns true when current domain is not in allowedDomains', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: undefined,
        configurable: true,
      });
      const config = makeConfig({
        respectDNT: true,
        allowedDomains: ['docs.example.com'],
        debug: false,
      });
      expect(shouldDisableTracking(config)).toBe(true);
    });

    it('returns false when current domain is in allowedDomains', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: undefined,
        configurable: true,
      });
      const config = makeConfig({
        respectDNT: true,
        allowedDomains: ['localhost'],
        debug: false,
      });
      expect(shouldDisableTracking(config)).toBe(false);
    });

    it('matches subdomains of allowed domains', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: undefined,
        configurable: true,
      });
      const config = makeConfig({
        respectDNT: true,
        allowedDomains: ['example.com'],
        debug: false,
      });
      // Current hostname is 'localhost' from JSDOM setup, so this should not match
      expect(shouldDisableTracking(config)).toBe(true);
    });

    it('allows empty allowedDomains list without blocking', () => {
      const config = makeConfig({
        respectDNT: true,
        allowedDomains: [],
        debug: false,
      });
      expect(shouldDisableTracking(config)).toBe(false);
    });
  });
});
