/**
 * Do11y — Documentation Observability
 *
 * Framework selector presets and the applyFrameworkSelectors() function.
 */
import type { Do11yConfig, FrameworkSelectors } from "./types.js";
import { SELECTOR_KEYS } from "./constants.js";

export const FRAMEWORK_PRESETS: Record<string, FrameworkSelectors> = {
  mintlify: {
    searchSelector: '#search-bar-entry, #search-bar-entry-mobile, [class*="search"]',
    copyButtonSelector: 'button[class*="copy"], button[aria-label*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector:
      'nav, [role="navigation"], #navbar, #sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: 'tabs, [role="tablist"], [class*="tab"]',
    tocSelector:
      '#table-of-contents, [data-testid="table-of-contents"], [class*="table-of-contents"], [class*="toc"]',
    feedbackSelector:
      'feedback-toolbar, #feedback-thumbs-up, #feedback-thumbs-down, [class*="feedback"], [class*="helpful"]',
  },
  docusaurus: {
    searchSelector: ".DocSearch, .DocSearch-Button",
    copyButtonSelector: 'button.clean-btn[aria-label*="copy" i], button[class*="copyButton"]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector:
      'nav, [role="navigation"], .navbar, .sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '.tabs[role="tablist"], [class*="tabs"]',
    tocSelector: '.table-of-contents, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  nextra: {
    searchSelector:
      '.nextra-search input, input[placeholder*="search" i], button[aria-label*="search" i]',
    copyButtonSelector:
      'button[class*="copy"], button[aria-label*="copy" i], button[title*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '.nextra-toc, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  "mkdocs-material": {
    searchSelector: ".md-search__input",
    copyButtonSelector: '.md-clipboard, .md-code__button[title="Copy to clipboard"]',
    codeBlockSelector: 'pre, code, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .md-nav, .md-sidebar',
    footerSelector: 'footer, [role="contentinfo"], .md-footer',
    contentSelector: 'main, article, [role="main"], .md-content',
    tabContainerSelector: ".tabbed-labels, .md-typeset .tabbed-set",
    tocSelector: '.md-sidebar--secondary .md-nav, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  vitepress: {
    searchSelector: ".VPNavBarSearch button, .VPNavBarSearchButton, #local-search",
    copyButtonSelector: 'button.copy, .vp-code-copy, button.copy[title*="Copy"]',
    codeBlockSelector: 'div[class*="language-"], pre, [class*="code"]',
    navigationSelector:
      'nav, [role="navigation"], .VPNav, .VPSidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], .VPFooter, [class*="footer"]',
    contentSelector: 'main, article, [role="main"], .VPContent, [class*="content"]',
    tabContainerSelector: '.vp-code-group .tabs, [role="tablist"]',
    tocSelector: ".VPDocAsideOutline, .VPLocalNavOutlineDropdown, a.outline-link",
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  starlight: {
    searchSelector:
      'site-search button[data-open-modal], sl-doc-search .DocSearch-Button, button[aria-label*="search" i]',
    copyButtonSelector: ".expressive-code .copy button, .copy button[data-code]",
    codeBlockSelector: ".expressive-code pre, pre",
    navigationSelector: 'nav, [role="navigation"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, .sl-markdown-content, [role="main"]',
    tabContainerSelector: 'starlight-tabs [role="tablist"], [role="tablist"]',
    tocSelector: ".right-sidebar-panel, starlight-toc, mobile-starlight-toc",
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  docsy: {
    searchSelector: ".td-search input, .td-search__input, #docsearch-0, #docsearch-1",
    copyButtonSelector: 'button[aria-label*="copy" i], button[title*="copy" i], .td-click-to-copy',
    codeBlockSelector: ".highlight, pre.chroma, pre",
    navigationSelector: 'nav, [role="navigation"], .td-sidebar, .td-navbar, [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], .td-footer, [class*="footer"]',
    contentSelector: 'main, article, [role="main"], .td-content, [class*="content"]',
    tabContainerSelector: '.nav-tabs[role="tablist"], [role="tablist"], .tab-content',
    tocSelector: '.td-toc, nav[id="TableOfContents"], [class*="toc"]',
    feedbackSelector: '.feedback--answer, [class*="feedback"], [class*="helpful"]',
  },
};

/**
 * Apply framework-specific selectors to the config.
 * For 'custom', uses whatever the user set in config; for named
 * frameworks, loads the preset and lets explicit config values override.
 */
export function applyFrameworkSelectors(config: Do11yConfig): void {
  const preset = FRAMEWORK_PRESETS[config.framework];

  if (preset) {
    SELECTOR_KEYS.forEach((key) => {
      if (!config[key]) config[key] = preset[key];
    });
  } else if (config.framework !== "custom") {
    if (config.debug) {
      console.warn(
        `[Do11y] Unknown framework "${config.framework}". ` +
          "Falling back to generic selectors. Supported: " +
          Object.keys(FRAMEWORK_PRESETS).join(", ") +
          ", custom",
      );
    }
  }

  // Fallback for any selector still unset (covers 'custom' with partial overrides)
  const fallback = FRAMEWORK_PRESETS.mintlify;
  if (!fallback) return;
  SELECTOR_KEYS.forEach((key) => {
    if (!config[key]) config[key] = fallback[key];
  });
}
