/**
 * Do11y — Documentation Observability
 *
 * Shared event rate limiter used by both the standalone transport and the
 * OTel instrumentation build.
 *
 * Rate-limiting prevents event spam (duplicate `page_exit` on SPA
 * navigation, rapid same-type bursts). The rate-limit key is per event
 * name, except for scroll depth milestones: a fast scroll can cross several
 * thresholds in a single frame, so the key includes the threshold attribute
 * to let each milestone through independently.
 */
import { ATTR_DO11Y_SCROLL_THRESHOLD } from "./constants.js";

/** Default minimum gap between events of the same type. */
export const DEFAULT_RATE_LIMIT_MS = 100;

export interface RateLimiter {
  /**
   * Returns true if the event may pass, false if it falls within the
   * rate-limit window for its key. Logs a debug message when dropped.
   */
  allow(
    eventName: string,
    eventData: Record<string, unknown>,
    rateLimitMs: number,
    debug: boolean,
  ): boolean;

  /** Clear all tracked timestamps. */
  reset(): void;
}

export function createRateLimiter(): RateLimiter {
  const lastEventTime: Record<string, number> = {};
  return {
    allow(eventName, eventData, rateLimitMs, debug) {
      const now = Date.now();

      // Distinct scroll milestones must not rate-limit each other: a fast
      // scroll can cross several thresholds in a single frame, which would
      // otherwise drop all but the first milestone. Key on the threshold
      // attribute when present so each milestone is rate-limited independently.
      const rateKey =
        eventData[ATTR_DO11Y_SCROLL_THRESHOLD] !== null &&
        eventData[ATTR_DO11Y_SCROLL_THRESHOLD] !== undefined
          ? `${eventName}:${String(eventData[ATTR_DO11Y_SCROLL_THRESHOLD])}`
          : eventName;

      if (rateLimitMs > 0 && lastEventTime[rateKey]) {
        if (now - lastEventTime[rateKey] < rateLimitMs) {
          if (debug) {
            console.log("[Do11y] Rate limited:", eventName);
          }
          return false;
        }
      }
      lastEventTime[rateKey] = now;
      return true;
    },
    reset() {
      for (const key of Object.keys(lastEventTime)) delete lastEventTime[key];
    },
  };
}
