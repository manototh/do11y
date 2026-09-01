/**
 * Do11y — Test Helpers
 *
 * Shared Do11yConfig factory for unit tests.
 *
 * Provides a default config with all fields set to sensible test defaults.
 * Individual test files can pass overrides to customise specific fields
 * (selectors, boolean flags, etc.) without repeating the full object.
 *
 * Usage:
 *   import { makeConfig } from '../../helpers/config';
 *   const cfg = makeConfig({ trackSearch: false, searchSelector: '.my-input' });
 */

import type { Do11yConfig } from '@do11y/core/types';

/**
 * Build a default Do11yConfig suitable for unit tests.
 *
 * @param overrides - Partial config fields to merge over the defaults.
 * @returns A fully populated Do11yConfig object.
 */
export function makeConfig(overrides: Partial<Do11yConfig> = {}): Do11yConfig {
  return {
    // Destination
    destination: 'http',
    supabaseUrl: '',
    supabaseKey: '',
    supabaseTable: 'do11y_events',
    endpoint: '',
    headers: {},
    bodyTransform: undefined,

    // OTel SDK
    otelSdkEndpoint: '',
    otelSdkHeaders: {},
    otelSdkServiceName: '',
    otelSdkResourceAttributes: {},

    // General behaviour
    debug: false,
    flushInterval: 5000,
    maxBatchSize: 10,

    // Link tracking
    trackOutboundLinks: true,
    trackInternalLinks: true,

    // Scroll tracking
    trackScrollDepth: true,
    scrollThresholds: [25, 50, 75, 90],

    // Domain / privacy
    allowedDomains: null,
    respectDNT: true,

    // Retry / rate-limit
    maxRetries: 2,
    retryDelay: 1000,
    rateLimitMs: 100,

    // Framework
    framework: 'mintlify',

    // Section visibility
    trackSectionVisibility: true,
    sectionVisibleThreshold: 3,

    // Feature toggles
    trackSearch: true,
    trackCopy: true,
    trackTabSwitches: true,
    trackTocClicks: true,
    trackExpandCollapse: true,
    trackFeedback: true,

    // CSS selectors (null = auto-detect / framework default)
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
    sessionAttributes: true,

    ...overrides,
  } as Do11yConfig;
}
