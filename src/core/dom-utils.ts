/**
 * Do11y — Documentation Observability
 *
 * DOM utility functions shared by all distribution layers.
 */
import type { Do11yConfig } from "./types.js";
import { validateSelector } from "./privacy.js";

export function getElementClassName(el: Element): string {
  if (typeof el.className === "string") return el.className;
  const svgClass = el.className as SVGAnimatedString;
  if (svgClass && typeof svgClass.baseVal === "string") return svgClass.baseVal;
  return "";
}

export function languageFromClassName(className: string): string | null {
  const match = className.match(/(?:^|\s)language-([\w-]+)(?:\s|$)/);
  return match ? match[1]! : null;
}

/**
 * Read the code block language from the element and its ancestors.
 * Frameworks often put `language-*` on a wrapper div (VitePress, Prism)
 * rather than on the pre/code element itself.
 */
export function extractCodeLanguage(start: Element | null): string {
  if (!start) return "unknown";

  let el: Element | null = start;
  for (let depth = 0; el && depth < 12; depth++, el = el.parentElement) {
    for (const attr of ["language", "data-language", "data-lang", "data-code-lang"]) {
      const value = el.getAttribute(attr);
      if (value) return value;
    }

    const fromClass = languageFromClassName(getElementClassName(el));
    if (fromClass) return fromClass;

    // VitePress renders <span class="lang">bash</span> beside the copy button.
    const langSpan = el.querySelector(":scope > span.lang");
    const langText = langSpan?.textContent?.trim();
    if (langText) return langText;

    // Broader search: any descendant with language metadata
    // (catches cases where language is nested deeper in the subtree,
    //  e.g. Mintlify's <pre language="mdx"> / <code language="mdx">).
    const deepLang = el.querySelector(
      '[data-language], [data-lang], [data-code-lang], [class*="language-"], [language]',
    );
    if (deepLang) {
      const dl =
        deepLang.getAttribute("language") ??
        deepLang.getAttribute("data-language") ??
        deepLang.getAttribute("data-lang") ??
        deepLang.getAttribute("data-code-lang") ??
        languageFromClassName(getElementClassName(deepLang));
      if (dl) return dl;
    }
  }

  return "unknown";
}

export function resolveTocHash(href: string): string | null {
  if (href.startsWith("#")) return href;
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return null;
  const pathPart = href.slice(0, hashIndex);
  if (
    !pathPart ||
    pathPart === window.location.pathname ||
    pathPart === `${window.location.pathname}${window.location.search}`
  ) {
    return href.slice(hashIndex);
  }
  return null;
}

export function resolveTocContainer(link: Element, config: Do11yConfig): Element | null {
  // Try the user-configured selector first (highest priority)
  const userSelector = validateSelector(config.tocSelector);
  if (userSelector) {
    const container = link.closest(userSelector);
    if (container && container !== link && container.tagName !== "A") return container;
  }

  // Framework-specific selectors (ordered by specificity)
  const knownContainers = [
    ".VPDocAsideOutline",
    ".VPLocalNavOutlineDropdown",
    ".table-of-contents",
    ".right-sidebar-panel",
    "starlight-toc",
    '[class*="TableOfContents"]',
    '[class*="page-outline"]',
    '[class*="toc"]',
    'nav[id="TableOfContents"]',
  ];

  for (const sel of knownContainers) {
    const container = link.closest(sel);
    if (container && container !== link && container.tagName !== "A") return container;
  }

  // Fallback: use parentElement if nothing matched
  return link.parentElement && link.parentElement !== document.body ? link.parentElement : null;
}

export function getNearestHeading(element: Element): string | null {
  let current: Element | null = element;

  while (current && current !== document.body) {
    let sibling: Element | null = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        return sibling.textContent?.trim().substring(0, 100) ?? null;
      }
      const headings = sibling.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (headings.length > 0) {
        return headings[headings.length - 1]!.textContent?.trim().substring(0, 100) ?? null;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return null;
}

export function sanitizeText(text: string | null | undefined, maxLength?: number): string | null {
  if (!text || typeof text !== "string") return null;

  const limit = maxLength ?? 100;

  let sanitized = text;
  // Email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  // US phone numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");
  // SSNs
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]");
  // Credit card numbers (13–19 digits, optionally space/dash separated)
  sanitized = sanitized.replace(/\b(?:\d[ -]?){13,19}\b/g, "[card]");
  // JWTs (three base64url segments separated by dots)
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]");
  // API tokens and generic bearer-style tokens (xaat-..., xapt-..., etc.)
  sanitized = sanitized.replace(/\bxa[a-z]{2}-[A-Za-z0-9_-]{20,}/g, "[token]");
  // Generic long hex secrets (32+ hex chars)
  sanitized = sanitized.replace(/\b[0-9a-fA-F]{32,}\b/g, "[redacted]");

  return sanitized.trim().substring(0, limit);
}
