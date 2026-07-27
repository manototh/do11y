/**
 * Do11y — Documentation Observability
 *
 * Expand/collapse tracking for <details> and aria-expanded elements.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText, getNearestHeading } from '../dom-utils.js';
import {
  EVENT_EXPAND_COLLAPSE,
  ATTR_DO11Y_EXPAND_SUMMARY,
  ATTR_DO11Y_EXPAND_ACTION,
  ATTR_DO11Y_EXPAND_SECTION,
} from '../constants.js';

export function setupExpandCollapseTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackExpandCollapse) return;

  // Native <details> elements
  document.addEventListener('toggle', (e) => {
    const details = e.target as HTMLDetailsElement;
    if (details.tagName !== 'DETAILS') return;

    const summary = details.querySelector('summary');
    const label = sanitizeText(summary ? summary.textContent : '', 100);

    emit(EVENT_EXPAND_COLLAPSE, {
      [ATTR_DO11Y_EXPAND_SUMMARY]: label,
      [ATTR_DO11Y_EXPAND_ACTION]: details.open ? 'expand' : 'collapse',
      [ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(details), 100),
    });
  }, true);

  // Accordion-style elements controlled by aria-expanded
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest(
      '[aria-expanded], [class*="accordion"] button, [class*="collapsible"] button'
    );
    if (!trigger) return;
    if (trigger.closest('details')) return;
    // Sidebar navigation toggles (nextra, vitepress, mkdocs sidebar sections,
    // etc.) also use aria-expanded but are structural UI, not content
    // expandables. Exclude anything inside a navigation landmark.
    if (trigger.closest('nav, [role="navigation"], header')) return;

    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';

    emit(EVENT_EXPAND_COLLAPSE, {
      [ATTR_DO11Y_EXPAND_SUMMARY]: sanitizeText(trigger.textContent, 100),
      [ATTR_DO11Y_EXPAND_ACTION]: wasExpanded ? 'collapse' : 'expand',
      [ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(trigger), 100),
    });
  });
}
