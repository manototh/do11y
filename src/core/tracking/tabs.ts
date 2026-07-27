/**
 * Do11y — Documentation Observability
 *
 * Tab switch tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText, getNearestHeading } from '../dom-utils.js';
import { validateSelector } from '../privacy.js';
import {
  EVENT_TAB_SWITCH,
  ATTR_DO11Y_TAB_LABEL,
  ATTR_DO11Y_TAB_GROUP,
  ATTR_DO11Y_TAB_IS_DEFAULT,
} from '../constants.js';

export function setupTabSwitchTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackTabSwitches) return;

  document.addEventListener('click', (e) => {
    let baseSel = '[role="tab"], .tabs button, .tabs a, .tabbed-labels label';
    const safeTabSel = validateSelector(config.tabContainerSelector);
    if (safeTabSel) {
      baseSel +=
        ', ' + safeTabSel + ' button, ' +
        safeTabSel + ' a, ' +
        safeTabSel + ' label';
    }
    const tab = (e.target as Element).closest(baseSel);
    if (!tab) return;

    const isAlreadyActive =
      tab.getAttribute('aria-selected') === 'true' ||
      tab.classList.contains('active') ||
      tab.classList.contains('is-active');
    if (isAlreadyActive) return;

    const label = sanitizeText(tab.textContent, 50);
    if (!label) return;

    const section = sanitizeText(getNearestHeading(tab), 100);

    emit(EVENT_TAB_SWITCH, {
      [ATTR_DO11Y_TAB_LABEL]: label,
      [ATTR_DO11Y_TAB_GROUP]: section,
      [ATTR_DO11Y_TAB_IS_DEFAULT]: false,
    });
  });
}
