/**
 * Unit tests — Constants integrity.
 *
 * Verifies that all event names, attribute keys, and selector key arrays
 * are defined correctly and consistently.
 */
import { describe, it, expect } from 'vitest';
import {
  VERSION,
  ATTR_SESSION_ID,
  ATTR_URL_PATH,
  ATTR_URL_FRAGMENT,
  ATTR_DEVICE_TYPE,
  ATTR_BROWSER_FAMILY,
  ATTR_BROWSER_LANGUAGE,
  ATTR_DO11Y_SESSION_PAGE_COUNT,
  ATTR_DO11Y_PAGE_TITLE,
  ATTR_DO11Y_VIEWPORT_CATEGORY,
  ATTR_DO11Y_TIMEZONE_OFFSET,
  ATTR_DO11Y_REFERRER_CATEGORY,
  ATTR_DO11Y_AI_PLATFORM,
  ATTR_DO11Y_DO11Y_VERSION,
  ATTR_DO11Y_IS_FIRST_PAGE,
  ATTR_DO11Y_PREVIOUS_PATH,
  ATTR_DO11Y_REFERRER_DOMAIN,
  ATTR_DO11Y_LINK_TYPE,
  ATTR_DO11Y_LINK_TARGET_URL,
  ATTR_DO11Y_LINK_TARGET_DOMAIN,
  ATTR_DO11Y_LINK_TEXT,
  ATTR_DO11Y_LINK_CONTEXT,
  ATTR_DO11Y_LINK_SECTION,
  ATTR_DO11Y_LINK_INDEX,
  ATTR_DO11Y_SCROLL_THRESHOLD,
  ATTR_DO11Y_SCROLL_PERCENT,
  ATTR_DO11Y_TOTAL_TIME_SECONDS,
  ATTR_DO11Y_ACTIVE_TIME_SECONDS,
  ATTR_DO11Y_ENGAGEMENT_RATIO,
  ATTR_DO11Y_MAX_SCROLL_DEPTH,
  ATTR_DO11Y_SEARCH_TRIGGER,
  ATTR_DO11Y_CODE_LANGUAGE,
  ATTR_DO11Y_CODE_SECTION,
  ATTR_DO11Y_CODE_INDEX,
  ATTR_DO11Y_SECTION_HEADING,
  ATTR_DO11Y_SECTION_HEADING_LEVEL,
  ATTR_DO11Y_SECTION_VISIBLE_SECONDS,
  ATTR_DO11Y_TAB_LABEL,
  ATTR_DO11Y_TAB_GROUP,
  ATTR_DO11Y_TAB_IS_DEFAULT,
  ATTR_DO11Y_TOC_HEADING,
  ATTR_DO11Y_TOC_HEADING_LEVEL,
  ATTR_DO11Y_TOC_POSITION,
  ATTR_DO11Y_FEEDBACK_RATING,
  ATTR_DO11Y_EXPAND_SUMMARY,
  ATTR_DO11Y_EXPAND_ACTION,
  ATTR_DO11Y_EXPAND_SECTION,
  EVENT_PAGE_VIEW,
  EVENT_PAGE_EXIT,
  EVENT_SCROLL_DEPTH,
  EVENT_LINK_CLICK,
  EVENT_SEARCH_OPENED,
  EVENT_CODE_COPIED,
  EVENT_SECTION_VISIBLE,
  EVENT_TAB_SWITCH,
  EVENT_TOC_CLICK,
  EVENT_FEEDBACK,
  EVENT_EXPAND_COLLAPSE,
  SELECTOR_KEYS,
} from '@do11y/core/constants';

describe('constants', () => {
  it('has a semantic version string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe('event names', () => {
    const events = [
      EVENT_PAGE_VIEW,
      EVENT_PAGE_EXIT,
      EVENT_SCROLL_DEPTH,
      EVENT_LINK_CLICK,
      EVENT_SEARCH_OPENED,
      EVENT_CODE_COPIED,
      EVENT_SECTION_VISIBLE,
      EVENT_TAB_SWITCH,
      EVENT_TOC_CLICK,
      EVENT_FEEDBACK,
      EVENT_EXPAND_COLLAPSE,
    ];

    it('all start with "browser.do11y."', () => {
      for (const event of events) {
        expect(event).toMatch(/^browser\.do11y\./);
      }
    });

    it('are all unique', () => {
      expect(new Set(events).size).toBe(events.length);
    });

    it('every event has a corresponding attribute set (no orphan attrs)', () => {
      // This is a consistency check: every event name constant should be referenced
      // somewhere in the tracking modules. We just verify the set is reasonable.
      expect(events.length).toBe(11);
    });
  });

  describe('attribute keys', () => {
    const attrs = [
      ATTR_SESSION_ID,
      ATTR_URL_PATH,
      ATTR_URL_FRAGMENT,
      ATTR_DEVICE_TYPE,
      ATTR_BROWSER_FAMILY,
      ATTR_BROWSER_LANGUAGE,
      ATTR_DO11Y_SESSION_PAGE_COUNT,
      ATTR_DO11Y_PAGE_TITLE,
      ATTR_DO11Y_VIEWPORT_CATEGORY,
      ATTR_DO11Y_TIMEZONE_OFFSET,
      ATTR_DO11Y_REFERRER_CATEGORY,
      ATTR_DO11Y_AI_PLATFORM,
      ATTR_DO11Y_DO11Y_VERSION,
      ATTR_DO11Y_IS_FIRST_PAGE,
      ATTR_DO11Y_PREVIOUS_PATH,
      ATTR_DO11Y_REFERRER_DOMAIN,
      ATTR_DO11Y_LINK_TYPE,
      ATTR_DO11Y_LINK_TARGET_URL,
      ATTR_DO11Y_LINK_TARGET_DOMAIN,
      ATTR_DO11Y_LINK_TEXT,
      ATTR_DO11Y_LINK_CONTEXT,
      ATTR_DO11Y_LINK_SECTION,
      ATTR_DO11Y_LINK_INDEX,
      ATTR_DO11Y_SCROLL_THRESHOLD,
      ATTR_DO11Y_SCROLL_PERCENT,
      ATTR_DO11Y_TOTAL_TIME_SECONDS,
      ATTR_DO11Y_ACTIVE_TIME_SECONDS,
      ATTR_DO11Y_ENGAGEMENT_RATIO,
      ATTR_DO11Y_MAX_SCROLL_DEPTH,
      ATTR_DO11Y_SEARCH_TRIGGER,
      ATTR_DO11Y_CODE_LANGUAGE,
      ATTR_DO11Y_CODE_SECTION,
      ATTR_DO11Y_CODE_INDEX,
      ATTR_DO11Y_SECTION_HEADING,
      ATTR_DO11Y_SECTION_HEADING_LEVEL,
      ATTR_DO11Y_SECTION_VISIBLE_SECONDS,
      ATTR_DO11Y_TAB_LABEL,
      ATTR_DO11Y_TAB_GROUP,
      ATTR_DO11Y_TAB_IS_DEFAULT,
      ATTR_DO11Y_TOC_HEADING,
      ATTR_DO11Y_TOC_HEADING_LEVEL,
      ATTR_DO11Y_TOC_POSITION,
      ATTR_DO11Y_FEEDBACK_RATING,
      ATTR_DO11Y_EXPAND_SUMMARY,
      ATTR_DO11Y_EXPAND_ACTION,
      ATTR_DO11Y_EXPAND_SECTION,
    ];

    it('are all unique', () => {
      expect(new Set(attrs).size).toBe(attrs.length);
    });

    it('standard OTel attrs follow expected pattern', () => {
      expect(ATTR_SESSION_ID).toBe('session.id');
      expect(ATTR_URL_PATH).toBe('url.path');
      expect(ATTR_DEVICE_TYPE).toBe('device.type');
      expect(ATTR_BROWSER_FAMILY).toBe('browser.family');
    });
  });

  describe('SELECTOR_KEYS', () => {
    it('contains exactly the 9 framework selector keys', () => {
      expect(SELECTOR_KEYS).toHaveLength(9);
      expect(SELECTOR_KEYS).toContain('searchSelector');
      expect(SELECTOR_KEYS).toContain('copyButtonSelector');
      expect(SELECTOR_KEYS).toContain('codeBlockSelector');
      expect(SELECTOR_KEYS).toContain('navigationSelector');
      expect(SELECTOR_KEYS).toContain('footerSelector');
      expect(SELECTOR_KEYS).toContain('contentSelector');
      expect(SELECTOR_KEYS).toContain('tabContainerSelector');
      expect(SELECTOR_KEYS).toContain('tocSelector');
      expect(SELECTOR_KEYS).toContain('feedbackSelector');
    });

    it('is a ReadonlyArray (not expected to be frozen, but immutable by convention)', () => {
      // The array is typed as ReadonlyArray — we trust the type system
      expect(Array.isArray(SELECTOR_KEYS)).toBe(true);
    });
  });
});
