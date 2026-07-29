/**
 * Export test — DocsInstrumentation → OTel API.
 *
 * Tests that the DocsInstrumentation class correctly wires up all
 * tracking modules and emits events through the OTel LoggerProvider API.
 *
 * No credentials required. Uses a mock LoggerProvider via vi.mock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../helpers/mock-dom';

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
    instrumentation = new DocsInstrumentation({
      framework: 'mintlify',
      debug: false,
      searchSelector: '.search-input',
      copyButtonSelector: '.copy-btn, button[aria-label*="copy"]',
      codeBlockSelector: 'pre',
      tocSelector: '.table-of-contents',
      contentSelector: 'main',
      navigationSelector: 'nav',
      footerSelector: 'footer',
      sectionVisibleThreshold: 0,
    });
    instrumentation.enable();

    const records = getRecords();
    const pageViews = records.filter(r => r.eventName === 'browser.do11y.page_view');
    expect(pageViews.length).toBeGreaterThanOrEqual(1);
  });

  it('emits link_click event when a link is clicked', () => {
    instrumentation = new DocsInstrumentation({
      framework: 'custom',
      debug: false,
      searchSelector: '.search-input',
      copyButtonSelector: '.copy-btn, button[aria-label*="copy"]',
      codeBlockSelector: 'pre',
      tocSelector: '.table-of-contents',
      contentSelector: 'main',
      navigationSelector: 'nav',
      footerSelector: 'footer',
      sectionVisibleThreshold: 0,
    });
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
    instrumentation = new DocsInstrumentation({
      framework: 'custom',
      debug: false,
      copyButtonSelector: '.copy-btn, button[aria-label*="copy"]',
      codeBlockSelector: 'pre',
      contentSelector: 'main',
      sectionVisibleThreshold: 0,
    });
    instrumentation.enable();
    clearRecords();

    const copyBtn = document.querySelector('.copy-btn')!;
    clickElement(copyBtn);

    const records = getRecords();
    const copies = records.filter(r => r.eventName === 'browser.do11y.code_copied');
    expect(copies.length).toBeGreaterThanOrEqual(1);
    expect(copies[0]!.attributes['browser.do11y.code.language']).toBeTruthy();
  });

  it('emits expand_collapse event when details is toggled', () => {
    instrumentation = new DocsInstrumentation({
      framework: 'custom',
      debug: false,
      contentSelector: 'main',
      sectionVisibleThreshold: 0,
    });
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
    instrumentation = new DocsInstrumentation({
      framework: 'custom',
      debug: false,
      tocSelector: '.table-of-contents',
      contentSelector: 'main',
      sectionVisibleThreshold: 0,
    });
    instrumentation.enable();
    clearRecords();

    const tocLink = document.querySelector('.table-of-contents a')!;
    clickElement(tocLink);

    const records = getRecords();
    const tocClicks = records.filter(r => r.eventName === 'browser.do11y.toc_click');
    expect(tocClicks.length).toBeGreaterThanOrEqual(1);
  });

  it('disable() stops emitting events', () => {
    instrumentation = new DocsInstrumentation({
      framework: 'mintlify',
      debug: false,
      sectionVisibleThreshold: 0,
    });
    instrumentation.enable();
    instrumentation.disable();
    clearRecords();

    clickElement(document.body);

    const records = getRecords();
    expect(records.length).toBe(0);
  });
});
