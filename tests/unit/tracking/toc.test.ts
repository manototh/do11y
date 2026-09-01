/**
 * Unit tests — TOC click tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupTocClickTracking } from '@do11y/core/tracking/toc';
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

const TOC_SELECTOR = {
  tocSelector: '.table-of-contents',
};

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
    setupTocClickTracking(makeConfig(TOC_SELECTOR), emit);
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
