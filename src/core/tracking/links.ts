/**
 * Do11y — Documentation Observability
 *
 * Link click tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText, getNearestHeading } from '../dom-utils.js';
import {
  EVENT_LINK_CLICK,
  ATTR_DO11Y_LINK_TYPE,
  ATTR_DO11Y_LINK_TARGET_URL,
  ATTR_DO11Y_LINK_TARGET_DOMAIN,
  ATTR_DO11Y_LINK_TEXT,
  ATTR_DO11Y_LINK_CONTEXT,
  ATTR_DO11Y_LINK_SECTION,
  ATTR_DO11Y_LINK_INDEX,
} from '../constants.js';

function getLinkContext(link: Element, config: Do11yConfig): string {
  if (link.closest(config.navigationSelector!)) return 'navigation';
  if (link.closest(config.footerSelector!)) return 'footer';
  if (link.closest(config.contentSelector!)) return 'content';
  return 'other';
}

/**
 * Pre-compute same-href indices for all `<a>` elements on the page.
 * This avoids O(n) querySelectorAll calls on every click.
 * Data attributes are set at init time and read directly on click.
 */
function precomputeLinkIndices(): void {
  try {
    const linkGroups = new Map<string, Element[]>();
    const allLinks = document.querySelectorAll('a[href]');
    allLinks.forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      const group = linkGroups.get(href) ?? [];
      group.push(link);
      linkGroups.set(href, group);
    });
    linkGroups.forEach((links) => {
      links.forEach((link, idx) => {
        link.setAttribute('data-do11y-link-idx', String(idx + 1));
      });
    });
  } catch {
    // Selector or iteration failed — fall through to runtime attribute read
  }
}

export function setupLinkTracking(config: Do11yConfig, emit: EmitFn): void {
  // Pre-compute link indices at init time
  precomputeLinkIndices();

  // Use capture phase so the handler fires before SPA routers (VitePress,
  // Docusaurus, Nextra, etc.) can call stopPropagation / stopImmediatePropagation.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    let linkType = 'other';
    let targetDomain: string | null = null;

    try {
      if (href.startsWith('#')) {
        linkType = 'anchor';
      } else if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
        linkType = 'internal';
      } else if (href.startsWith('http')) {
        const url = new URL(href);
        if (url.hostname === window.location.hostname) {
          linkType = 'internal';
        } else {
          linkType = 'external';
          targetDomain = url.hostname;
        }
      } else if (href.startsWith('mailto:')) {
        linkType = 'email';
      }
    } catch {
      // Invalid URL
    }

    if (linkType === 'internal' && !config.trackInternalLinks) return;
    if (linkType === 'external' && !config.trackOutboundLinks) return;

    // Read pre-computed index from data attribute; fall back to 1 if not found
    const linkIndex = parseInt(link.getAttribute('data-do11y-link-idx') ?? '1', 10);

    emit(EVENT_LINK_CLICK, {
      [ATTR_DO11Y_LINK_TYPE]: linkType,
      [ATTR_DO11Y_LINK_TARGET_URL]: href,
      [ATTR_DO11Y_LINK_TARGET_DOMAIN]: targetDomain,
      [ATTR_DO11Y_LINK_TEXT]: sanitizeText(link.textContent, 100),
      [ATTR_DO11Y_LINK_CONTEXT]: getLinkContext(link, config),
      [ATTR_DO11Y_LINK_SECTION]: sanitizeText(getNearestHeading(link), 100),
      [ATTR_DO11Y_LINK_INDEX]: linkIndex,
    });
  }, true);
}
