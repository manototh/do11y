/**
 * Do11y — Documentation Observability
 *
 * Copy code tracking.
 */
import type { Do11yConfig, EmitFn } from '../types.js';
import { sanitizeText, extractCodeLanguage, getNearestHeading } from '../dom-utils.js';
import {
  EVENT_CODE_COPIED,
  ATTR_DO11Y_CODE_LANGUAGE,
  ATTR_DO11Y_CODE_SECTION,
  ATTR_DO11Y_CODE_INDEX,
} from '../constants.js';

function getCodeBlockIndex(codeBlock: Element | null, config: Do11yConfig): number {
  if (!codeBlock) return 1;
  try {
    const allBlocks = document.querySelectorAll(config.codeBlockSelector!);
    for (let i = 0; i < allBlocks.length; i++) {
      if (allBlocks[i] === codeBlock) return i + 1;
    }
  } catch {
    // Selector failed
  }
  return 1;
}

export function setupCopyTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackCopy) return;

  document.addEventListener('click', (e) => {
    const copyButton = (e.target as Element).closest(config.copyButtonSelector!);
    if (copyButton) {
      const codeBlock: Element | null =
        copyButton.closest('[class*="language-"], [language]') ??
        copyButton.closest(config.codeBlockSelector!) ??
        // For Starlight / Expressive Code: the <pre> is a sibling, not
        // an ancestor, of the copy button's container. Look for it
        // inside the .expressive-code wrapper.
        copyButton.closest('.expressive-code')?.querySelector('pre') ??
        copyButton.closest('div, section')?.querySelector('pre') ??
        copyButton.parentElement?.querySelector('pre') ??
        null;

      const codeEl: Element | null = codeBlock
        ? (codeBlock.tagName === 'PRE'
          ? codeBlock.querySelector('code')
          : codeBlock.querySelector('code[class*="language-"], code[language]') ?? codeBlock.querySelector('code'))
        : null;

      const language = extractCodeLanguage(codeEl ?? codeBlock ?? copyButton);

      emit(EVENT_CODE_COPIED, {
        [ATTR_DO11Y_CODE_LANGUAGE]: language,
        [ATTR_DO11Y_CODE_SECTION]: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
        [ATTR_DO11Y_CODE_INDEX]: getCodeBlockIndex(codeBlock, config),
      });
    }
  }, true);
}
