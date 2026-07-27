/**
 * Do11y — Documentation Observability
 *
 * Security and privacy checks.
 */
import type { Do11yConfig } from './types.js';

/**
 * Validate a CSS selector string supplied through user configuration.
 * Returns the selector unchanged if it is syntactically valid, or null
 * if it is not. This prevents CSS selector injection from attacker-
 * controlled config values (window.Do11yConfig / meta tags) reaching
 * querySelectorAll / closest calls.
 */
export function validateSelector(selector: string | null | undefined): string | null {
  if (!selector || typeof selector !== 'string') return null;
  try {
    document.querySelector(selector);
    return selector;
  } catch {
    return null;
  }
}

export function shouldDisableTracking(config: Do11yConfig): boolean {
  if (config.respectDNT && (
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes' ||
    window.doNotTrack === '1'
  )) {
    if (config.debug) {
      console.log('[Do11y] Disabled: Do Not Track is enabled');
    }
    return true;
  }

  if (config.allowedDomains && config.allowedDomains.length > 0) {
    const currentDomain = window.location.hostname;
    const isAllowed = config.allowedDomains.some((domain) => {
      return currentDomain === domain || currentDomain.endsWith('.' + domain);
    });
    if (!isAllowed) {
      if (config.debug) {
        console.log('[Do11y] Disabled: Domain not allowed:', currentDomain);
      }
      return true;
    }
  }

  return false;
}
