/**
 * Do11y — Documentation Observability
 *
 * Core module barrel export.
 * Re-exports everything needed by the standalone and instrumentation layers.
 */

// Types
export type {
  FrameworkPreset,
  FrameworkSelectors,
  Destination,
  Do11yConfig,
  Do11yEvent,
  Do11yAPI,
  EmitFn,
  SessionData,
  BrowserContext,
  PageInfo,
  ReferrerInfo,
} from './types.js';

// Constants
export {
  VERSION,
  ATTR_SESSION_ID,
  ATTR_URL_PATH,
  ATTR_URL_FRAGMENT,
  ATTR_URL_QUERY,
  ATTR_DO11Y_URL_HAS_PARAMS,
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
} from './constants.js';

// Presets
export { FRAMEWORK_PRESETS, applyFrameworkSelectors } from './presets.js';

// Privacy
export { validateSelector, shouldDisableTracking } from './privacy.js';

// DOM utilities
export {
  getElementClassName,
  languageFromClassName,
  extractCodeLanguage,
  resolveTocHash,
  resolveTocContainer,
  sanitizeText,
  getNearestHeading,
} from './dom-utils.js';

// Session
export { getSession, saveSession, updatePageSequence, generateSessionId } from './session.js';

// Context
export {
  categorizeViewport,
  getBrowserFamily,
  getDeviceType,
  getBrowserContext,
  AI_REFERRER_PATTERNS,
  classifyReferrer,
  getReferrerDomain,
  getPageInfo,
} from './context.js';

// Tracking
export { trackPageView } from './tracking/page-view.js';
export { setupLinkTracking } from './tracking/links.js';
export {
  setupScrollTracking,
  checkScrollDepth,
  resetTrackedScrollDepths,
  getTrackedScrollDepths,
} from './tracking/scroll.js';
export {
  setupEngagementTracking,
  emitPageExit,
  resetEngagementState,
  pageExited,
} from './tracking/engagement.js';
export { setupSearchTracking } from './tracking/search.js';
export { setupCopyTracking } from './tracking/copy.js';
export {
  setupSectionVisibilityTracking,
  observeHeadings,
  flushVisibleSections,
  disconnectSectionObserver,
} from './tracking/sections.js';
export { setupTabSwitchTracking } from './tracking/tabs.js';
export { setupTocClickTracking } from './tracking/toc.js';
export { setupFeedbackTracking } from './tracking/feedback.js';
export { setupExpandCollapseTracking } from './tracking/expand.js';
