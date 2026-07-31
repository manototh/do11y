/**
 * Export test — DocsInstrumentation → OTel API.
 *
 * Tests that the DocsInstrumentation class correctly wires up all
 * tracking modules and emits events through the OTel LoggerProvider API.
 *
 * No credentials required. Uses a mock LoggerProvider via vi.mock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDOM,
  teardownTestDOM,
  clickElement,
  pressKey,
  triggerBeforeUnload,
} from '../helpers/mock-dom';
import { resetTrackedScrollDepths } from '@do11y/core/tracking/scroll';

// Mock @opentelemetry/api-logs so DocsInstrumentation uses our test logger
const mockLogRecords: Array<{
  eventName: string;
  severityNumber: number;
  attributes: Record<string, unknown>;
  body: string;
}> = [];

vi.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: () => ({
      emit: (record: any) => {
        mockLogRecords.push({ ...record, attributes: { ...record.attributes } });
      },
    }),
  },
}));

import { DocsInstrumentation } from '@do11y/instrumentation/index';

function clearRecords(): void {
  mockLogRecords.length = 0;
}

function getRecords() {
  return [...mockLogRecords];
}

/**
 * Build a DocsInstrumentation config with common tracking selectors.
 */
function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    framework: 'custom',
    debug: false,
    searchSelector: '#search-bar-entry, .search-input',
    copyButtonSelector: '.copy-btn, button[aria-label*="copy"]',
    codeBlockSelector: 'pre',
    tocSelector: '.table-of-contents',
    contentSelector: 'main',
    navigationSelector: 'nav',
    footerSelector: 'footer',
    feedbackSelector: '.feedback',
    tabContainerSelector: '[role="tablist"]',
    sectionVisibleThreshold: 0,
    trackSectionVisibility: true,
    trackTabSwitches: true,
    trackFeedback: true,
    trackTocClicks: true,
    trackExpandCollapse: true,
    ...overrides,
  };
}

describe('export / instrumentation-otel', () => {
  let instrumentation: DocsInstrumentation;

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <nav><a href="/guide">Guide</a></nav>
        <main>
          <h1>Getting Started</h1>
          <h2>Installation</h2>
          <p>Content here</p>
          <pre><code class="language-js">console.log('hello')</code></pre>
          <button class="copy-btn" aria-label="Copy code">Copy</button>
          <div class="table-of-contents"><a href="#installation">Installation</a></div>
          <div class="feedback"><button data-value="yes">Yes</button></div>
          <div role="tablist">
            <button role="tab">Tab 1</button>
            <button role="tab" class="active">Tab 2</button>
          </div>
          <div id="search-bar-entry"></div>
          <details><summary>Details</summary><p>Hidden</p></details>
        </main>
        <footer><a href="https://example.com">External</a></footer>
      </body></html>
    `);
    clearRecords();
  });

  afterEach(() => {
    if (instrumentation) {
      instrumentation.disable();
    }
    teardownTestDOM();
  });

  it('emits page_view event when enabled', () => {
    instrumentation = new DocsInstrumentation(makeConfig());
    instrumentation.enable();

    const records = getRecords();
    const pageViews = records.filter(r => r.eventName === 'browser.do11y.page_view');
    expect(pageViews.length).toBeGreaterThanOrEqual(1);
  });

  it('emits link_click event when a link is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig());
    instrumentation.enable();
    clearRecords();

    const internalLink = document.querySelector('a[href="/guide"]')!;
    clickElement(internalLink);

    const records = getRecords();
    const linkClicks = records.filter(r => r.eventName === 'browser.do11y.link_click');
    expect(linkClicks.length).toBeGreaterThanOrEqual(1);
    expect(linkClicks[0]!.attributes['browser.do11y.link.type']).toBe('internal');
  });

  it('emits code_copied event when copy button is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      copyButtonSelector: '.copy-btn, button[aria-label*="copy"]',
      codeBlockSelector: 'pre',
      contentSelector: 'main',
    }));
    instrumentation.enable();
    clearRecords();

    const copyBtn = document.querySelector('.copy-btn')!;
    clickElement(copyBtn);

    const records = getRecords();
    const copies = records.filter(r => r.eventName === 'browser.do11y.code_copied');
    expect(copies.length).toBeGreaterThanOrEqual(1);
    expect(copies[0]!.attributes['browser.do11y.code.language']).toBeTruthy();
  });

  it('emits search_opened event when a search element is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      searchSelector: '#search-bar-entry, .search-input',
    }));
    instrumentation.enable();
    clearRecords();

    const searchBtn = document.querySelector('#search-bar-entry')!;
    clickElement(searchBtn);

    const records = getRecords();
    const searches = records.filter(r => r.eventName === 'browser.do11y.search_opened');
    expect(searches.length).toBeGreaterThanOrEqual(1);
  });

  it('emits search_opened event on Cmd+K keyboard shortcut', () => {
    instrumentation = new DocsInstrumentation(makeConfig());
    instrumentation.enable();
    clearRecords();

    pressKey('k', document.body, { metaKey: true });

    const records = getRecords();
    const searches = records.filter(r => r.eventName === 'browser.do11y.search_opened');
    expect(searches.length).toBeGreaterThanOrEqual(1);
    expect(searches[0]!.attributes['browser.do11y.search.trigger']).toBe('keyboard');
  });

  it('emits feedback event when a feedback button is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      feedbackSelector: '.feedback',
    }));
    instrumentation.enable();
    clearRecords();

    const fbBtn = document.querySelector('.feedback button')!;
    clickElement(fbBtn);

    const records = getRecords();
    const feedbacks = records.filter(r => r.eventName === 'browser.do11y.feedback');
    expect(feedbacks.length).toBeGreaterThanOrEqual(1);
    expect(feedbacks[0]!.attributes['browser.do11y.feedback.rating']).toBe('yes');
  });

  it('emits tab_switch event when a non-active tab is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      tabContainerSelector: '[role="tablist"]',
    }));
    instrumentation.enable();
    clearRecords();

    const tab = document.querySelector('[role="tab"]:not(.active)')!;
    clickElement(tab);

    const records = getRecords();
    const switches = records.filter(r => r.eventName === 'browser.do11y.tab_switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
    expect(switches[0]!.attributes['browser.do11y.tab.label']).toBeTruthy();
  });

  it('emits expand_collapse event when details is toggled', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      contentSelector: 'main',
    }));
    instrumentation.enable();
    clearRecords();

    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true });
    details.dispatchEvent(toggleEvent);

    const records = getRecords();
    const expands = records.filter(r => r.eventName === 'browser.do11y.expand_collapse');
    expect(expands.length).toBeGreaterThanOrEqual(1);
    expect(expands[0]!.attributes['browser.do11y.expand.action']).toBe('expand');
  });

  it('emits toc_click event when a TOC link is clicked', () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      tocSelector: '.table-of-contents',
      contentSelector: 'main',
    }));
    instrumentation.enable();
    clearRecords();

    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);

    const records = getRecords();
    const tocClicks = records.filter(r => r.eventName === 'browser.do11y.toc_click');
    expect(tocClicks.length).toBeGreaterThanOrEqual(1);
  });

  it('emits scroll_depth event when the page is scrolled', () => {
    // Reset module-level state that may have been populated by earlier tests.
    resetTrackedScrollDepths();

    // Override scrollY via defineProperty so the init checkScrollDepth call
    // in setupScrollTracking sees mock scroll metrics.
    Object.defineProperty(window, 'scrollY', {
      value: 1050, // ~50%: (1050 / (3000 - 900)) ≈ 0.50
      configurable: true,
      writable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 3000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      configurable: true,
    });

    instrumentation = new DocsInstrumentation(makeConfig({
      scrollThresholds: [25, 50],
    }));
    instrumentation.enable();

    const records = getRecords();
    const scrolls = records.filter(r => r.eventName === 'browser.do11y.scroll_depth');
    expect(scrolls.length).toBeGreaterThanOrEqual(1);
    expect(scrolls[0]!.attributes['browser.do11y.scroll.threshold']).toBeDefined();
  });

  it('emits every scroll_depth threshold through the rate limiter', () => {
    // Reset module-level state that may have been populated by earlier tests.
    resetTrackedScrollDepths();

    // Scroll far past 100% so every threshold is crossed in a single frame.
    Object.defineProperty(window, 'scrollY', {
      value: 100000,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 3000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      configurable: true,
    });

    // Large rate-limit window to force collisions between milestones.
    // enabled:false avoids the base constructor auto-enabling as well, which
    // would register a second (unrate-limited) emit path.
    instrumentation = new DocsInstrumentation(makeConfig({
      enabled: false,
      scrollThresholds: [25, 50, 75, 90],
      rateLimitMs: 1000,
    }));
    instrumentation.enable();

    const records = getRecords();
    const thresholds = records
      .filter(r => r.eventName === 'browser.do11y.scroll_depth')
      .map(r => r.attributes['browser.do11y.scroll.threshold']);
    expect(thresholds).toEqual([25, 50, 75, 90]);
  });

  it('rate-limits duplicate same-type events', () => {
    // enabled:false so the base constructor doesn't auto-enable too; a single
    // enable() registers one listener set sharing one rate limiter.
    instrumentation = new DocsInstrumentation(makeConfig({
      enabled: false,
      rateLimitMs: 1000,
    }));
    instrumentation.enable();
    clearRecords();

    // Two synchronous clicks on the same TOC link: only the first should
    // pass the rate limiter.
    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);
    clickElement(tocLink);

    const records = getRecords();
    const tocClicks = records.filter(r => r.eventName === 'browser.do11y.toc_click');
    expect(tocClicks.length).toBe(1);
  });

  it('emits section_visible event when headings are observed', async () => {
    instrumentation = new DocsInstrumentation(makeConfig({
      sectionVisibleThreshold: 0,
      trackSectionVisibility: true,
    }));
    instrumentation.enable();

    // The mock IntersectionObserver fires immediately on observe(), but the
    // section tracking uses setTimeout(..., threshold) to delay emission.
    // With threshold=0, the timer fires on the next microtask tick.
    await new Promise(r => setTimeout(r, 0));

    const records = getRecords();
    const sections = records.filter(r => r.eventName === 'browser.do11y.section_visible');
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0]!.attributes['browser.do11y.section.heading']).toBeTruthy();
    expect(sections[0]!.attributes['browser.do11y.section.heading_level']).toBe(2);
  });

  it('emits page_exit event on beforeunload', () => {
    instrumentation = new DocsInstrumentation(makeConfig());
    instrumentation.enable();
    clearRecords();

    triggerBeforeUnload();

    const records = getRecords();
    const exits = records.filter(r => r.eventName === 'browser.do11y.page_exit');
    expect(exits.length).toBeGreaterThanOrEqual(1);
    expect(exits[0]!.attributes['browser.do11y.page_exit.total_time_seconds']).toBeGreaterThanOrEqual(0);
  });

  it('disable() stops emitting events', () => {
    instrumentation = new DocsInstrumentation(makeConfig());
    instrumentation.enable();
    instrumentation.disable();
    clearRecords();

    clickElement(document.body);

    const records = getRecords();
    expect(records.length).toBe(0);
  });

  describe('OTel API envelope shape', () => {
    it('every emitted record has eventName, severityNumber, attributes and body', () => {
      instrumentation = new DocsInstrumentation(makeConfig());
      instrumentation.enable();

      const records = getRecords();
      expect(records.length).toBeGreaterThan(0);

      for (const record of records) {
        expect(record).toHaveProperty('eventName');
        expect(typeof record.eventName).toBe('string');
        expect(record.eventName).toMatch(/^browser\.do11y\./);
        expect(record).toHaveProperty('severityNumber', 9);
        expect(record).toHaveProperty('body');
        expect(typeof record.body).toBe('string');
        expect(record).toHaveProperty('attributes');
        expect(typeof record.attributes).toBe('object');
        expect(record.attributes).not.toBeNull();
      }
    });

    it('includes standard attributes on every record', () => {
      instrumentation = new DocsInstrumentation(makeConfig());
      instrumentation.enable();

      const records = getRecords();
      const first = records[0]!;

      expect(first.attributes).toHaveProperty('browser.do11y.version');
      expect(first.attributes['browser.do11y.version']).toBe('0.2.0');
      expect(first.attributes).toHaveProperty('browser.family');
      expect(first.attributes).toHaveProperty('device.type');
      expect(first.attributes).toHaveProperty('browser.language');
      expect(first.attributes).toHaveProperty('url.path');
    });
  });
});
