/**
 * Unit tests — Tab switch tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupTabSwitchTracking } from '@do11y/core/tracking/tabs';
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

describe('tracking / tabs', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Code Examples</h2>
        <div role="tablist">
          <button role="tab" aria-selected="true">Active Tab</button>
          <button role="tab">Second Tab</button>
          <button role="tab">Third Tab</button>
        </div>
      </body></html>
    `);
    emitted = [];
    setupTabSwitchTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits tab_switch when clicking a non-active tab', () => {
    const tabs = document.querySelectorAll('[role="tab"]');
    clickElement(tabs[1]!); // Click "Second Tab"
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.tab_switch');
    expect(emitted[0].data['browser.do11y.tab.label']).toBe('Second Tab');
  });

  it('does not emit when clicking the already-active tab', () => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]')!;
    clickElement(tab);
    expect(emitted).toHaveLength(0);
  });

  it('identifies the tab group from the nearest heading', () => {
    const tab = document.querySelectorAll('[role="tab"]')[1]!;
    clickElement(tab);
    expect(emitted[0].data['browser.do11y.tab.group']).toBeTruthy();
  });

  it('sets is_default to false for non-active tabs', () => {
    const tab = document.querySelectorAll('[role="tab"]')[1]!;
    clickElement(tab);
    expect(emitted[0].data['browser.do11y.tab.is_default']).toBe(false);
  });
});
