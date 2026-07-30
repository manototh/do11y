/**
 * Unit tests — Expand/collapse tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM, clickElement } from '../../helpers/mock-dom';
import { setupExpandCollapseTracking } from '@do11y/core/tracking/expand';
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

describe('tracking / expand', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Advanced Options</h2>
        <details>
          <summary>Click to expand</summary>
          <p>Hidden content</p>
        </details>
        <details>
          <summary>Another section</summary>
          <p>More hidden content</p>
        </details>
      </body></html>
    `);
    emitted = [];
    setupExpandCollapseTracking(makeConfig(), emit);
  });

  afterEach(() => {
    teardownTestDOM();
  });

  it('emits expand_collapse when toggling a details element', () => {
    const details = document.querySelector('details')!;
    // Simulate toggle event
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].name).toBe('browser.do11y.expand_collapse');
    expect(emitted[0].data['browser.do11y.expand.action']).toBe('expand');
  });

  it('includes the summary text', () => {
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted[0].data['browser.do11y.expand.summary']).toBe('Click to expand');
  });

  it('includes the section heading', () => {
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted[0].data['browser.do11y.expand.section']).toBe('Advanced Options');
  });

  it('respects trackExpandCollapse=false', () => {
    teardownTestDOM();
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Section</h2>
        <details>
          <summary>Click to expand</summary>
          <p>Hidden content</p>
        </details>
      </body></html>
    `);
    emitted = [];
    setupExpandCollapseTracking(makeConfig({ trackExpandCollapse: false }), emit);
    const details = document.querySelector('details')!;
    details.open = true;
    const toggleEvent = new Event('toggle', { bubbles: true, cancelable: false });
    details.dispatchEvent(toggleEvent);
    expect(emitted).toHaveLength(0);
  });
});
