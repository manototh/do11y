/**
 * Do11y — Documentation Observability
 *
 * Section visibility tracking via IntersectionObserver.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText } from '../dom-utils.js';
import {
  EVENT_SECTION_VISIBLE,
  ATTR_DO11Y_SECTION_HEADING,
  ATTR_DO11Y_SECTION_HEADING_LEVEL,
  ATTR_DO11Y_SECTION_VISIBLE_SECONDS,
} from '../constants.js';

let sectionObserver: IntersectionObserver | null = null;
let sectionTimers: Record<string, { start: number; reported: boolean }> = {};

export function setupSectionVisibilityTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackSectionVisibility) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const threshold = config.sectionVisibleThreshold * 1000;

  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute('data-do11y-section-id');
      if (!id) return;

      if (entry.isIntersecting) {
        if (!sectionTimers[id]) {
          sectionTimers[id] = { start: Date.now(), reported: false };
        }
      } else {
        if (sectionTimers[id] && !sectionTimers[id].reported) {
          const elapsed = Date.now() - sectionTimers[id].start;
          if (elapsed >= threshold) {
            const heading = entry.target.textContent?.trim() ?? '';
            emit(EVENT_SECTION_VISIBLE, {
              [ATTR_DO11Y_SECTION_HEADING]: sanitizeText(heading, 100),
              [ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(entry.target.tagName.charAt(1), 10),
              [ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsed / 1000),
            });
            sectionTimers[id].reported = true;
          }
        }
        delete sectionTimers[id];
      }
    });
  }, { threshold: 0.5 });

  observeHeadings();
}

export function observeHeadings(): void {
  if (!sectionObserver) return;
  const headings = document.querySelectorAll('h2, h3');
  headings.forEach((h, i) => {
    // Always overwrite any pre-existing attribute value. A heading authored
    // with a crafted data-do11y-section-id could otherwise inject an
    // unescaped string into the querySelector in flushVisibleSections().
    h.setAttribute('data-do11y-section-id', 'section-' + i);
    sectionObserver!.observe(h);
  });
}

export function flushVisibleSections(config: Do11yConfig, emit: EmitFn): void {
  if (!sectionObserver) return;
  const now = Date.now();
  const threshold = config.sectionVisibleThreshold * 1000;
  Object.keys(sectionTimers).forEach((id) => {
    const timer = sectionTimers[id];
    if (timer && !timer.reported) {
      const elapsed = now - timer.start;
      if (elapsed >= threshold) {
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(id)
          : id.replace(/["\\]/g, '\\$&');
        const el = document.querySelector('[data-do11y-section-id="' + escapedId + '"]');
        if (el) {
          emit(EVENT_SECTION_VISIBLE, {
            [ATTR_DO11Y_SECTION_HEADING]: sanitizeText(el.textContent?.trim() ?? '', 100),
            [ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(el.tagName.charAt(1), 10),
            [ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsed / 1000),
          });
        }
      }
    }
  });
  sectionTimers = {};
}

export function disconnectSectionObserver(): void {
  if (sectionObserver) {
    flushVisibleSections({ trackSectionVisibility: false, sectionVisibleThreshold: 0 } as Do11yConfig, () => {});
    sectionObserver.disconnect();
    sectionObserver = null;
  }
}
