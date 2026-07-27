/**
 * Do11y — Documentation Observability
 *
 * Browser context and referrer classification utilities.
 */
import type { BrowserContext, PageInfo, ReferrerInfo } from './types.js';
import { sanitizeText } from './dom-utils.js';
import {
  ATTR_DO11Y_VIEWPORT_CATEGORY,
  ATTR_BROWSER_FAMILY,
  ATTR_DEVICE_TYPE,
  ATTR_BROWSER_LANGUAGE,
  ATTR_DO11Y_TIMEZONE_OFFSET,
  ATTR_URL_PATH,
  ATTR_URL_FRAGMENT,
  ATTR_URL_QUERY,
  ATTR_DO11Y_PAGE_TITLE,
} from './constants.js';

export function categorizeViewport(): string {
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  return 'large-desktop';
}

export function getBrowserFamily(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

export function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad/.test(ua)) {
    if (/iPad|Tablet/.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

export function getBrowserContext(): BrowserContext {
  return {
    [ATTR_DO11Y_VIEWPORT_CATEGORY]: categorizeViewport(),
    [ATTR_BROWSER_FAMILY]: getBrowserFamily(),
    [ATTR_DEVICE_TYPE]: getDeviceType(),
    [ATTR_BROWSER_LANGUAGE]: (navigator.language || '').split('-')[0] || 'unknown',
    [ATTR_DO11Y_TIMEZONE_OFFSET]: new Date().getTimezoneOffset() / 60,
  };
}

/**
 * Known AI platform referrer patterns.
 * Each entry maps a substring found in the referrer hostname to an AI
 * platform label. Order matters: first match wins.
 */
export const AI_REFERRER_PATTERNS: ReadonlyArray<{ match: string; platform: string }> = [
  { match: 'chatgpt',    platform: 'ChatGPT' },
  { match: 'chat.com',   platform: 'ChatGPT' },
  { match: 'openai',     platform: 'ChatGPT' },
  { match: 'perplexity', platform: 'Perplexity' },
  { match: 'claude.ai',  platform: 'Claude' },
  { match: 'anthropic',  platform: 'Claude' },
  { match: 'gemini',     platform: 'Gemini' },
  { match: 'copilot',    platform: 'Copilot' },
  { match: 'deepseek',   platform: 'DeepSeek' },
  { match: 'meta.ai',    platform: 'Meta AI' },
  { match: 'grok',       platform: 'Grok' },
  { match: 'x.ai',       platform: 'Grok' },
  { match: 'mistral',    platform: 'Mistral' },
  { match: 'you.com',    platform: 'You.com' },
  { match: 'phind',      platform: 'Phind' },
];

/**
 * Classify a referrer hostname into a traffic source category.
 * Returns { referrerCategory, aiPlatform } where aiPlatform is null
 * for non-AI traffic.
 */
export function classifyReferrer(hostname: string): ReferrerInfo {
  if (!hostname || hostname === 'direct') {
    return { referrerCategory: 'direct', aiPlatform: null };
  }
  if (hostname === 'internal') {
    return { referrerCategory: 'internal', aiPlatform: null };
  }
  if (hostname === 'unknown') {
    return { referrerCategory: 'unknown', aiPlatform: null };
  }

  const h = hostname.toLowerCase();

  for (const pattern of AI_REFERRER_PATTERNS) {
    if (h.indexOf(pattern.match) !== -1) {
      return { referrerCategory: 'ai', aiPlatform: pattern.platform };
    }
  }

  if (/google\.|bing\.|baidu\.|yandex\.|duckduckgo\.|yahoo\./.test(h)) {
    return { referrerCategory: 'search-engine', aiPlatform: null };
  }
  if (/github\.|gitlab\.|bitbucket\./.test(h)) {
    return { referrerCategory: 'code-host', aiPlatform: null };
  }
  if (/stackoverflow\.|stackexchange\.|reddit\.|news\.ycombinator\./.test(h)) {
    return { referrerCategory: 'community', aiPlatform: null };
  }
  if (/twitter\.|x\.com|linkedin\.|facebook\.|threads\.net/.test(h)) {
    return { referrerCategory: 'social', aiPlatform: null };
  }

  return { referrerCategory: 'other', aiPlatform: null };
}

export function getReferrerDomain(): string {
  try {
    if (!document.referrer) return 'direct';
    const url = new URL(document.referrer);
    if (url.hostname === window.location.hostname) return 'internal';
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

export function getPageInfo(): PageInfo {
  return {
    [ATTR_URL_PATH]: window.location.pathname,
    [ATTR_URL_FRAGMENT]: window.location.hash || null,
    [ATTR_URL_QUERY]: window.location.search ? 'has_params' : null,
    [ATTR_DO11Y_PAGE_TITLE]: sanitizeText(document.title, 150),
  };
}
