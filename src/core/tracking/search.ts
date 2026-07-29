/**
 * Do11y — Documentation Observability
 *
 * Search open tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import {
  EVENT_SEARCH_OPENED,
  ATTR_DO11Y_SEARCH_TRIGGER,
} from '../constants.js';

export function setupSearchTracking(config: Do11yConfig, emit: EmitFn): () => void {
  const clickHandler = (e: MouseEvent): void => {
    const searchTrigger = (e.target as Element).closest(config.searchSelector!);
    if (searchTrigger) {
      emit(EVENT_SEARCH_OPENED, {});
    }
  };
  // Use capture phase so the handler fires before framework event handlers
  // (e.g. Starlight's <site-search>) can call stopPropagation().
  document.addEventListener('click', clickHandler, true);

  const keydownHandler = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      emit(EVENT_SEARCH_OPENED, { [ATTR_DO11Y_SEARCH_TRIGGER]: 'keyboard' });
    }
  };
  document.addEventListener('keydown', keydownHandler);

  return () => {
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('keydown', keydownHandler);
  };
}
