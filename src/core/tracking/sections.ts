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

interface SectionTimer {
  start: number;
  reported: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

function emitSectionEvent(emit: EmitFn, el: Element, elapsedMs: number): void {
  emit(EVENT_SECTION_VISIBLE, {
    [ATTR_DO11Y_SECTION_HEADING]: sanitizeText(el.textContent?.trim() ?? '', 100),
    [ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(el.tagName.charAt(1), 10),
    [ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsedMs / 1000),
  });
}

let sectionObserver: IntersectionObserver | null = null;
let sectionTimers: Record<string, SectionTimer> = {};

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
          const timer: SectionTimer = { start: Date.now(), reported: false, timeoutId: null };
          // Fire the event early if the heading stays visible for the threshold duration,
          // so users who scroll past slowly or navigate away still get tracked.
          timer.timeoutId = setTimeout(() => {
            if (sectionTimers[id] && !sectionTimers[id].reported) {
              emitSectionEvent(emit, entry.target, threshold);
              sectionTimers[id].reported = true;
            }
          }, threshold);
          sectionTimers[id] = timer;
        }
      } else {
        if (sectionTimers[id]) {
          if (sectionTimers[id].timeoutId) {
            clearTimeout(sectionTimers[id].timeoutId);
          }
          if (!sectionTimers[id].reported) {
            const elapsed = Date.now() - sectionTimers[id].start;
            if (elapsed >= threshold) {
              emitSectionEvent(emit, entry.target, elapsed);
              sectionTimers[id].reported = true;
            }
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
      if (timer.timeoutId) clearTimeout(timer.timeoutId);
      const elapsed = now - timer.start;
      if (elapsed >= threshold) {
        // CSS.escape is available in all browsers that support IntersectionObserver.
        // The fallback handles the rare case where a test environment (e.g. jsdom)
        // doesn't implement CSS.escape.
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(id)
          : id.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~ ]/g, '\\$&');
        const el = document.querySelector('[data-do11y-section-id="' + escapedId + '"]');
        if (el) {
          emitSectionEvent(emit, el, elapsed);
        }
      }
    }
  });
  sectionTimers = {};
}

export function disconnectSectionObserver(): void {
  if (sectionObserver) {
    // Flush pending timers at their elapsed time instead of discarding them.
    // We still pass a noop emit to avoid emitting during teardown;
    // callers that need final emission should flushVisibleSections themselves.
    if (sectionTimers && Object.keys(sectionTimers).length > 0) {
      Object.keys(sectionTimers).forEach((id) => {
        const timer = sectionTimers[id];
        if (timer && !timer.reported) {
          if (timer.timeoutId) clearTimeout(timer.timeoutId);
        }
      });
      sectionTimers = {};
    }
    sectionObserver.disconnect();
    sectionObserver = null;
  }
}
