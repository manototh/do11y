/**
 * Unit tests — Search tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement, pressKey } from '../../helpers/mock-dom';
import { setupSearchTracking } from '@do11y/core/tracking/search';
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

const SEARCH_SELECTOR = {
  searchSelector: '.search-input, #search-bar-entry, .DocSearch-Button',
};

describe('tracking / search', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM();
    emitted = [];
    setupSearchTracking(makeConfig(SEARCH_SELECTOR), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits search_opened when clicking a search element', () => {
    const searchBtn = document.querySelector('.search-input') as HTMLElement;
    expect(searchBtn).toBeTruthy();
    clickElement(searchBtn);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.search_opened');
  });

  it('emits search_opened on Cmd+K', () => {
    pressKey('k', document.body, { metaKey: true });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.search_opened');
    expect(emitted[0].data['browser.do11y.search.trigger']).toBe('keyboard');
  });

  it('emits search_opened on Ctrl+K', () => {
    pressKey('k', document.body, { ctrlKey: true });
    expect(emitted).toHaveLength(1);
  });

  it('does not emit for non-search clicks', () => {
    clickElement(document.body);
    expect(emitted).toHaveLength(0);
  });
});
