/**
 * Do11y — Documentation Observability
 *
 * Table of Contents (TOC) click tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText, resolveTocHash, resolveTocContainer } from '../dom-utils.js';
import {
  EVENT_TOC_CLICK,
  ATTR_DO11Y_TOC_HEADING,
  ATTR_DO11Y_TOC_HEADING_LEVEL,
  ATTR_DO11Y_TOC_POSITION,
} from '../constants.js';

export function setupTocClickTracking(config: Do11yConfig, emit: EmitFn): () => void {
  if (!config.trackTocClicks) return () => { /* noop */ };

  // Use capture phase so the event is seen even if the framework
  // calls stopPropagation() during the bubble phase.
  const handler = (e: MouseEvent): void => {
    const link = (e.target as Element).closest('a');
    if (!link) return;

    const tocContainer = resolveTocContainer(link, config);
    if (!tocContainer) return;

    const href = link.getAttribute('href');
    const hash = href ? resolveTocHash(href) : null;
    if (!hash) return;

    const headingText = sanitizeText(link.textContent, 100);
    let headingLevel: number | null = null;
    try {
      const targetId = hash.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl && /^H[1-6]$/.test(targetEl.tagName)) {
        headingLevel = parseInt(targetEl.tagName.charAt(1), 10);
      }
    } catch { /* ignore */ }

    const tocLinks = tocContainer.querySelectorAll('a[href*="#"]');
    let tocPosition = 1;
    for (let i = 0; i < tocLinks.length; i++) {
      if (tocLinks[i] === link) { tocPosition = i + 1; break; }
    }

    emit(EVENT_TOC_CLICK, {
      [ATTR_DO11Y_TOC_HEADING]: headingText,
      [ATTR_DO11Y_TOC_HEADING_LEVEL]: headingLevel,
      [ATTR_DO11Y_TOC_POSITION]: tocPosition,
    });
  };
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
