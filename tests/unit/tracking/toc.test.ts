/**
 * Unit tests — TOC click tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupTocClickTracking } from '@do11y/core/tracking/toc';
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
    tabContainerSelector: null, tocSelector: '.table-of-contents',
    feedbackSelector: null,
    searchSelector: null, copyButtonSelector: null, codeBlockSelector: null,
    navigationSelector: null, footerSelector: null, contentSelector: null,
    useOtelBrowserInstrumentations: false,
    trackSpaPathChanges: false,
    ...overrides,
  };
}

describe('tracking / toc', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2 id="installation">Installation</h2>
        <p>Content</p>
        <h2 id="configuration">Configuration</h2>
        <p>More content</p>
        <div class="table-of-contents">
          <a href="#installation">Installation</a>
          <a href="#configuration">Configuration</a>
        </div>
      </body></html>
    `);
    emitted = [];
    setupTocClickTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits toc_click when clicking a TOC link', () => {
    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.toc_click');
  });

  it('includes the heading text from the link', () => {
    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);
    expect(emitted[0].data['browser.do11y.toc.heading']).toBe('Installation');
  });

  it('resolves heading level from the target element', () => {
    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);
    expect(emitted[0].data['browser.do11y.toc.heading_level']).toBe(2);
  });

  it('includes the TOC position (1-indexed)', () => {
    const tocLink = document.querySelectorAll('.table-of-contents a')[1]!;
    clickElement(tocLink);
    expect(emitted[0].data['browser.do11y.toc.position']).toBe(2);
  });

  it('does not emit for clicks on non-TOC links', () => {
    const link = document.createElement('a');
    link.href = '/somewhere';
    link.textContent = 'Somewhere';
    document.body.appendChild(link);
    clickElement(link);
    expect(emitted).toHaveLength(0);
  });

  it('respects trackTocClicks=false', () => {
    teardownTestDOM();
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2 id="installation">Installation</h2>
        <div class="table-of-contents">
          <a href="#installation">Installation</a>
        </div>
      </body></html>
    `);
    emitted = [];
    setupTocClickTracking(makeConfig({ trackTocClicks: false }), emit);
    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);
    expect(emitted).toHaveLength(0);
  });
});
