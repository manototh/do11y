/**
 * Do11y — Documentation Observability
 *
 * OTel semantic convention attribute keys and event names.
 *
 * Standard attrs from https://opentelemetry.io/docs/specs/semconv/.
 * Custom do11y attrs use the `browser.do11y.*` namespace.
 */

export const VERSION = '0.1.1';

// ─── Standard OTel attribute keys ────────────────────────────────────────────

export const ATTR_SESSION_ID = 'session.id';
export const ATTR_URL_PATH = 'url.path';
export const ATTR_URL_FRAGMENT = 'url.fragment';
export const ATTR_URL_QUERY = 'url.query';
export const ATTR_DEVICE_TYPE = 'device.type';
export const ATTR_BROWSER_FAMILY = 'browser.family';
export const ATTR_BROWSER_LANGUAGE = 'browser.language';

// ─── Custom do11y attribute keys ─────────────────────────────────────────────

export const ATTR_DO11Y_SESSION_PAGE_COUNT = 'browser.do11y.session_page_count';
export const ATTR_DO11Y_PAGE_TITLE = 'browser.do11y.page_title';
export const ATTR_DO11Y_VIEWPORT_CATEGORY = 'browser.do11y.viewport_category';
export const ATTR_DO11Y_TIMEZONE_OFFSET = 'browser.do11y.timezone_offset';
export const ATTR_DO11Y_REFERRER_CATEGORY = 'browser.do11y.referrer_category';
export const ATTR_DO11Y_AI_PLATFORM = 'browser.do11y.ai_platform';
export const ATTR_DO11Y_DO11Y_VERSION = 'browser.do11y.version';
export const ATTR_DO11Y_IS_FIRST_PAGE = 'browser.do11y.is_first_page';
export const ATTR_DO11Y_PREVIOUS_PATH = 'browser.do11y.previous_path';
export const ATTR_DO11Y_REFERRER_DOMAIN = 'browser.do11y.referrer_domain';
export const ATTR_DO11Y_LINK_TYPE = 'browser.do11y.link.type';
export const ATTR_DO11Y_LINK_TARGET_URL = 'browser.do11y.link.target_url';
export const ATTR_DO11Y_LINK_TARGET_DOMAIN = 'browser.do11y.link.target_domain';
export const ATTR_DO11Y_LINK_TEXT = 'browser.do11y.link.text';
export const ATTR_DO11Y_LINK_CONTEXT = 'browser.do11y.link.context';
export const ATTR_DO11Y_LINK_SECTION = 'browser.do11y.link.section';
export const ATTR_DO11Y_LINK_INDEX = 'browser.do11y.link.index';
export const ATTR_DO11Y_SCROLL_THRESHOLD = 'browser.do11y.scroll.threshold';
export const ATTR_DO11Y_SCROLL_PERCENT = 'browser.do11y.scroll.percent';
export const ATTR_DO11Y_TOTAL_TIME_SECONDS = 'browser.do11y.page_exit.total_time_seconds';
export const ATTR_DO11Y_ACTIVE_TIME_SECONDS = 'browser.do11y.page_exit.active_time_seconds';
export const ATTR_DO11Y_ENGAGEMENT_RATIO = 'browser.do11y.page_exit.engagement_ratio';
export const ATTR_DO11Y_MAX_SCROLL_DEPTH = 'browser.do11y.page_exit.max_scroll_depth';
export const ATTR_DO11Y_SEARCH_TRIGGER = 'browser.do11y.search.trigger';
export const ATTR_DO11Y_CODE_LANGUAGE = 'browser.do11y.code.language';
export const ATTR_DO11Y_CODE_SECTION = 'browser.do11y.code.section';
export const ATTR_DO11Y_CODE_INDEX = 'browser.do11y.code.index';
export const ATTR_DO11Y_SECTION_HEADING = 'browser.do11y.section.heading';
export const ATTR_DO11Y_SECTION_HEADING_LEVEL = 'browser.do11y.section.heading_level';
export const ATTR_DO11Y_SECTION_VISIBLE_SECONDS = 'browser.do11y.section.visible_seconds';
export const ATTR_DO11Y_TAB_LABEL = 'browser.do11y.tab.label';
export const ATTR_DO11Y_TAB_GROUP = 'browser.do11y.tab.group';
export const ATTR_DO11Y_TAB_IS_DEFAULT = 'browser.do11y.tab.is_default';
export const ATTR_DO11Y_TOC_HEADING = 'browser.do11y.toc.heading';
export const ATTR_DO11Y_TOC_HEADING_LEVEL = 'browser.do11y.toc.heading_level';
export const ATTR_DO11Y_TOC_POSITION = 'browser.do11y.toc.position';
export const ATTR_DO11Y_FEEDBACK_RATING = 'browser.do11y.feedback.rating';
export const ATTR_DO11Y_EXPAND_SUMMARY = 'browser.do11y.expand.summary';
export const ATTR_DO11Y_EXPAND_ACTION = 'browser.do11y.expand.action';
export const ATTR_DO11Y_EXPAND_SECTION = 'browser.do11y.expand.section';

// ─── OTel event names for do11y events (browser.do11y.* namespace) ──────────

export const EVENT_PAGE_VIEW = 'browser.do11y.page_view';
export const EVENT_PAGE_EXIT = 'browser.do11y.page_exit';
export const EVENT_SCROLL_DEPTH = 'browser.do11y.scroll_depth';
export const EVENT_LINK_CLICK = 'browser.do11y.link_click';
export const EVENT_SEARCH_OPENED = 'browser.do11y.search_opened';
export const EVENT_CODE_COPIED = 'browser.do11y.code_copied';
export const EVENT_SECTION_VISIBLE = 'browser.do11y.section_visible';
export const EVENT_TAB_SWITCH = 'browser.do11y.tab_switch';
export const EVENT_TOC_CLICK = 'browser.do11y.toc_click';
export const EVENT_FEEDBACK = 'browser.do11y.feedback';
export const EVENT_EXPAND_COLLAPSE = 'browser.do11y.expand_collapse';

// ─── Framework selector keys ─────────────────────────────────────────────────

import type { FrameworkSelectors } from './types.js';

export const SELECTOR_KEYS: ReadonlyArray<keyof FrameworkSelectors> = [
  'searchSelector',
  'copyButtonSelector',
  'codeBlockSelector',
  'navigationSelector',
  'footerSelector',
  'contentSelector',
  'tabContainerSelector',
  'tocSelector',
  'feedbackSelector',
];
