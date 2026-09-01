/**
 * Do11y — Documentation Observability
 *
 * Page view tracking.
 */
import type { Do11yConfig, EmitFn } from "../types.js";
import { getReferrerDomain, classifyReferrer } from "../context.js";
import { updatePageSequence, saveSession } from "../session.js";
import {
  EVENT_PAGE_VIEW,
  ATTR_DO11Y_REFERRER_DOMAIN,
  ATTR_DO11Y_REFERRER_CATEGORY,
  ATTR_DO11Y_AI_PLATFORM,
  ATTR_DO11Y_IS_FIRST_PAGE,
  ATTR_DO11Y_PREVIOUS_PATH,
} from "../constants.js";
import { resetPageExitedGuard } from "./engagement.js";

export function trackPageView(config: Do11yConfig, emit: EmitFn): void {
  // Reset the page_exit guard so the new page can emit its exit cleanly.
  // The guard is also reset by resetEngagementState() in handlePathChange(), but this
  // defence-in-depth ensures it resets even if that path isn't taken.
  resetPageExitedGuard();
  const session = updatePageSequence(window.location.pathname);

  const referrerDomain = getReferrerDomain();
  const referrerInfo = classifyReferrer(referrerDomain);

  if (session.pageCount === 1) {
    session.referrerCategory = referrerInfo.referrerCategory;
    session.aiPlatform = referrerInfo.aiPlatform;
    saveSession(session);
  }

  emit(EVENT_PAGE_VIEW, {
    [ATTR_DO11Y_REFERRER_DOMAIN]: referrerDomain,
    [ATTR_DO11Y_REFERRER_CATEGORY]: referrerInfo.referrerCategory,
    [ATTR_DO11Y_AI_PLATFORM]: referrerInfo.aiPlatform,
    [ATTR_DO11Y_IS_FIRST_PAGE]: session.pageCount === 1,
    [ATTR_DO11Y_PREVIOUS_PATH]:
      session.pageSequence.length > 1
        ? session.pageSequence[session.pageSequence.length - 2]!.path
        : null,
  });
}
