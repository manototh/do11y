/**
 * Do11y — Documentation Observability
 *
 * Feedback widget tracking.
 */
import type { Do11yConfig, EmitFn } from "../types.js";
import { validateSelector } from "../privacy.js";
import { EVENT_FEEDBACK, ATTR_DO11Y_FEEDBACK_RATING } from "../constants.js";

export function setupFeedbackTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackFeedback) return;

  document.addEventListener("click", (e) => {
    const button = (e.target as Element).closest('button, [role="button"], a');
    if (!button) return;

    const feedbackContainer = button.closest(
      validateSelector(config.feedbackSelector) ??
        '[class*="feedback"], [class*="helpful"], [class*="rating"], ' +
          '[class*="was-this"], [data-feedback]',
    );
    if (!feedbackContainer) return;

    const buttonText = (button.textContent ?? "").trim().toLowerCase();
    const ariaLabel = (button.getAttribute("aria-label") ?? "").toLowerCase();
    const titleAttr = (button.getAttribute("title") ?? "").toLowerCase();
    // data-md-value is used by MkDocs Material; data-value / data-feedback are used by other frameworks
    const rawDataValue =
      button.getAttribute("data-value") ??
      button.getAttribute("data-md-value") ??
      button.getAttribute("data-feedback");
    // Constrain data-value to a safe token: alphanumeric + common punctuation,
    // max 50 chars. Prevents arbitrary DOM-injected strings from reaching the
    // analytics dataset or a downstream dashboard unescaped.
    const dataValue =
      rawDataValue && /^[\w\s.,!?-]{1,50}$/.test(rawDataValue) ? rawDataValue : null;

    let rating: string | null = null;
    if (dataValue) {
      rating = dataValue;
    } else if (
      /\byes\b|👍|thumbs.?up|helpful/i.test(buttonText + " " + ariaLabel + " " + titleAttr)
    ) {
      rating = "yes";
    } else if (
      /\bno\b|👎|thumbs.?down|not.?helpful/i.test(buttonText + " " + ariaLabel + " " + titleAttr)
    ) {
      rating = "no";
    }
    if (!rating) return;

    emit(EVENT_FEEDBACK, { [ATTR_DO11Y_FEEDBACK_RATING]: rating });
  });
}
