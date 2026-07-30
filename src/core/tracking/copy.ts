/**
 * Do11y — Documentation Observability
 *
 * Copy code tracking.
 */
import type { Do11yConfig, EmitFn } from "../types.js";
import { sanitizeText, extractCodeLanguage, getNearestHeading } from "../dom-utils.js";
import {
  EVENT_CODE_COPIED,
  ATTR_DO11Y_CODE_LANGUAGE,
  ATTR_DO11Y_CODE_SECTION,
  ATTR_DO11Y_CODE_INDEX,
} from "../constants.js";

/**
 * Pre-compute code block indices at init time to avoid O(n) querySelectorAll
 * calls on every copy button click. Elements are assigned a
 * data-do11y-code-idx attribute read directly on click.
 */
function precomputeCodeBlockIndices(config: Do11yConfig): void {
  try {
    const allBlocks = document.querySelectorAll(config.codeBlockSelector!);
    allBlocks.forEach((block, idx) => {
      block.setAttribute("data-do11y-code-idx", String(idx + 1));
    });
  } catch {
    // Selector failed — fall through to runtime attribute read
  }
}

export function setupCopyTracking(config: Do11yConfig, emit: EmitFn): void {
  if (!config.trackCopy) return;

  // Pre-compute code block indices at init time
  precomputeCodeBlockIndices(config);

  document.addEventListener(
    "click",
    (e) => {
      const copyButton = (e.target as Element).closest(config.copyButtonSelector!);
      if (copyButton) {
        const codeBlock: Element | null =
          copyButton.closest('[class*="language-"], [language]') ??
          copyButton.closest(config.codeBlockSelector!) ??
          // For Starlight / Expressive Code: the <pre> is a sibling, not
          // an ancestor, of the copy button's container. Look for it
          // inside the .expressive-code wrapper.
          copyButton.closest(".expressive-code")?.querySelector("pre") ??
          copyButton.closest("div, section")?.querySelector("pre") ??
          copyButton.parentElement?.querySelector("pre") ??
          null;

        const codeEl: Element | null = codeBlock
          ? codeBlock.tagName === "PRE"
            ? codeBlock.querySelector("code")
            : (codeBlock.querySelector('code[class*="language-"], code[language]') ??
              codeBlock.querySelector("code"))
          : null;

        const language = extractCodeLanguage(codeEl ?? codeBlock ?? copyButton);

        // Read pre-computed index from data attribute; fall back to 1 if not found
        const codeIndex = parseInt(codeBlock?.getAttribute("data-do11y-code-idx") ?? "1", 10);

        emit(EVENT_CODE_COPIED, {
          [ATTR_DO11Y_CODE_LANGUAGE]: language,
          [ATTR_DO11Y_CODE_SECTION]: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
          [ATTR_DO11Y_CODE_INDEX]: codeIndex,
        });
      }
    },
    true,
  );
}
