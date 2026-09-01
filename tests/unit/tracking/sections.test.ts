/**
 * Unit tests — Section visibility tracking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  setupSectionVisibilityTracking,
  observeHeadings,
  flushVisibleSections,
  disconnectSectionObserver,
} from '@do11y/core/tracking/sections';
import { makeConfig } from '../../helpers/config';
import type { EmitFn } from '@do11y/core/types';

/** Sections test config: threshold 0 so flushVisibleSections fires immediately. */
const SECTION_CONFIG = { sectionVisibleThreshold: 0 };

describe('tracking / sections', () => {
  let emitted: Array<{ name: string; data: Record<string, unknown> }>;
  const emit: EmitFn = (name, data) => { emitted.push({ name, data }); };

  beforeEach(() => {
    setupTestDOM(`
      <!DOCTYPE html>
      <html><body>
        <h2>Getting Started</h2>
        <p>Content here</p>
        <h2>Installation</h2>
        <p>More content</p>
        <h3>Prerequisites</h3>
        <p>Details</p>
      </body></html>
    `);
    emitted = [];
  });

  afterEach(() => {
    disconnectSectionObserver();
    teardownTestDOM();
  });

  it('observes h2 and h3 elements and assigns section IDs', () => {
    setupSectionVisibilityTracking(makeConfig(SECTION_CONFIG), emit);
    const headings = document.querySelectorAll('[data-do11y-section-id]');
    expect(headings.length).toBe(3); // h2, h2, h3
    expect(headings[0]?.getAttribute('data-do11y-section-id')).toBe('section-0');
    expect(headings[1]?.getAttribute('data-do11y-section-id')).toBe('section-1');
    expect(headings[2]?.getAttribute('data-do11y-section-id')).toBe('section-2');
  });

  it('calls observeHeadings without throwing and observes new headings', () => {
    setupSectionVisibilityTracking(makeConfig(SECTION_CONFIG), emit);
    // Add a new heading after initial setup
    const newHeading = document.createElement('h2');
    newHeading.textContent = 'New Section';
    document.body.appendChild(newHeading);
    expect(() => observeHeadings()).not.toThrow();
    const headings = document.querySelectorAll('[data-do11y-section-id]');
    expect(headings.length).toBe(4);
  });

  it('flushVisibleSections emits events for visible sections with elapsed time >= threshold', () => {
    setupSectionVisibilityTracking(makeConfig(SECTION_CONFIG), emit);
    flushVisibleSections(makeConfig(SECTION_CONFIG), emit);
    // With sectionVisibleThreshold: 0, all observed sections should be reported
    const sectionEvents = emitted.filter(e => e.name === 'browser.do11y.section_visible');
    expect(sectionEvents.length).toBe(3);
    expect(sectionEvents[0]?.data['browser.do11y.section.heading']).toBe('Getting Started');
    expect(sectionEvents[1]?.data['browser.do11y.section.heading']).toBe('Installation');
    expect(sectionEvents[2]?.data['browser.do11y.section.heading']).toBe('Prerequisites');
  });

  it('disconnectSectionObserver cleans up and is idempotent', () => {
    setupSectionVisibilityTracking(makeConfig(), emit);
    disconnectSectionObserver();
    expect(() => disconnectSectionObserver()).not.toThrow();
    // After disconnect, no new events should be emitted
    emitted.length = 0;
    flushVisibleSections(makeConfig(), emit);
    expect(emitted).toHaveLength(0);
  });
});
