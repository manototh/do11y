/**
 * Do11y — Documentation Observability
 *
 * Scroll depth tracking.
 *
 * Some frameworks (MkDocs Material) use container-based
 * scrolling where the window itself never scrolls. We detect the scrollable
 * container by walking up from the content element and listen on it in
 * addition to the window.
 */
import type { Do11yConfig, EmitFn } from "../types.js";
import {
  EVENT_SCROLL_DEPTH,
  ATTR_DO11Y_SCROLL_THRESHOLD,
  ATTR_DO11Y_SCROLL_PERCENT,
} from "../constants.js";

let trackedScrollDepths = new Set<number>();
let scrollContainer: Element | null = null;

function findScrollableAncestor(el: Element): Element | null {
  let current: Element | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Check and track scroll depth thresholds.
 * Reads from the detected scroll container when present, otherwise
 * falls back to the window/document.
 *
 * If the page fits entirely in the viewport (no scrollbar), all
 * thresholds are marked as reached since the user can see 100% of
 * the content without scrolling.
 */
export function checkScrollDepth(config: Do11yConfig, emit: EmitFn): void {
  let scrollTop: number;
  let totalHeight: number;
  let viewportHeight: number;

  if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
    scrollTop = scrollContainer.scrollTop;
    totalHeight = scrollContainer.scrollHeight;
    viewportHeight = scrollContainer.clientHeight;
  } else {
    scrollTop = window.scrollY || document.documentElement.scrollTop;
    totalHeight = document.documentElement.scrollHeight;
    viewportHeight = window.innerHeight;
  }

  const docHeight = totalHeight - viewportHeight;

  if (docHeight <= 0) {
    config.scrollThresholds.forEach((threshold) => {
      if (!trackedScrollDepths.has(threshold)) {
        trackedScrollDepths.add(threshold);
        emit(EVENT_SCROLL_DEPTH, {
          [ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
          [ATTR_DO11Y_SCROLL_PERCENT]: 100,
        });
      }
    });
    return;
  }

  const scrollPercent = Math.round((scrollTop / docHeight) * 100);

  config.scrollThresholds.forEach((threshold) => {
    if (scrollPercent >= threshold && !trackedScrollDepths.has(threshold)) {
      trackedScrollDepths.add(threshold);
      emit(EVENT_SCROLL_DEPTH, {
        [ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
        [ATTR_DO11Y_SCROLL_PERCENT]: scrollPercent,
      });
    }
  });
}

export function setupScrollTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackScrollDepth) return;

  if (config.contentSelector) {
    const contentEl = document.querySelector(config.contentSelector);
    if (contentEl) {
      scrollContainer = findScrollableAncestor(contentEl);
    }
  }

  let ticking = false;
  function onScroll(): void {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        checkScrollDepth(config, emit);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll);
  if (scrollContainer) {
    scrollContainer.addEventListener("scroll", onScroll);
    if (config.debug) {
      const sc = scrollContainer as HTMLElement;
      console.log("[do11y] Using container-based scroll tracking:", sc.className || sc.tagName);
    }
  }

  // Run once on init so short pages that fit in the viewport get
  // recorded immediately (no scroll event will ever fire for them).
  checkScrollDepth(config, emit);
}

export function resetTrackedScrollDepths(): void {
  trackedScrollDepths = new Set();
}

export function getTrackedScrollDepths(): Set<number> {
  return trackedScrollDepths;
}
