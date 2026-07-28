/**
 * Do11y — Documentation Observability
 *
 * Time on page and engagement tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { getSession } from '../session.js';
import {
  EVENT_PAGE_EXIT,
  ATTR_DO11Y_TOTAL_TIME_SECONDS,
  ATTR_DO11Y_ACTIVE_TIME_SECONDS,
  ATTR_DO11Y_ENGAGEMENT_RATIO,
  ATTR_DO11Y_MAX_SCROLL_DEPTH,
  ATTR_DO11Y_REFERRER_CATEGORY,
  ATTR_DO11Y_AI_PLATFORM,
} from '../constants.js';
import { getTrackedScrollDepths } from './scroll.js';
import { flushVisibleSections } from './sections.js';

let pageLoadTime = Date.now();
let lastActivityTime = Date.now();
let totalActiveTime = 0;
let isPageVisible = true;
let pageExited = false;

/**
 * @param afterEmit Optional callback invoked after the exit event is emitted.
 *   Used by the standalone build to flush the transport before the page unloads.
 */
export function emitPageExit(config: Do11yConfig, emit: EmitFn, afterEmit?: () => void): void {
  // Prevent duplicate page_exit when both the MutationObserver (path change)
  // and the beforeunload event fire for the same navigation. The flag is
  // reset by trackPageView() when the next page starts.
  if (pageExited) return;
  pageExited = true;

  if (isPageVisible) {
    totalActiveTime += Date.now() - lastActivityTime;
  }

  const totalTime = Date.now() - pageLoadTime;
  const engagementRatio = totalTime > 0 ? totalActiveTime / totalTime : 0;

  let maxScroll = 0;
  getTrackedScrollDepths().forEach((depth) => {
    if (depth > maxScroll) maxScroll = depth;
  });

  flushVisibleSections(config, emit);

  const session = getSession();

  emit(EVENT_PAGE_EXIT, {
    [ATTR_DO11Y_TOTAL_TIME_SECONDS]: Math.round(totalTime / 1000),
    [ATTR_DO11Y_ACTIVE_TIME_SECONDS]: Math.round(totalActiveTime / 1000),
    [ATTR_DO11Y_ENGAGEMENT_RATIO]: Math.round(engagementRatio * 100) / 100,
    [ATTR_DO11Y_MAX_SCROLL_DEPTH]: maxScroll,
    [ATTR_DO11Y_REFERRER_CATEGORY]: session.referrerCategory,
    [ATTR_DO11Y_AI_PLATFORM]: session.aiPlatform,
  });

  // Flush immediately so the exit event is sent even if beforeunload
  // is interrupted (e.g. by Puppeteer's page.close destroying context).
  afterEmit?.();
}

export function setupEngagementTracking(config: Do11yConfig, emit: EmitFn): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isPageVisible) {
        totalActiveTime += Date.now() - lastActivityTime;
        isPageVisible = false;
      }
    } else {
      lastActivityTime = Date.now();
      isPageVisible = true;
    }
  });

  window.addEventListener('beforeunload', () => {
    emitPageExit(config, emit);
  });
}

export function resetEngagementState(): void {
  pageLoadTime = Date.now();
  lastActivityTime = Date.now();
  totalActiveTime = 0;
  isPageVisible = true;
  pageExited = false;
}

export { pageExited };
