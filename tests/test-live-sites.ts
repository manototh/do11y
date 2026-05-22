import puppeteer, { Browser, Page } from 'puppeteer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FrameworkSelectors {
  searchSelector: string;
  copyButtonSelector: string;
  codeBlockSelector: string;
  navigationSelector: string;
  footerSelector: string;
  contentSelector: string;
  tabContainerSelector: string;
  tocSelector: string;
  feedbackSelector: string;
}

interface SelectorResult {
  matched: number;
  firstTag?: string | null;
  firstClasses?: string | null;
  firstId?: string | null;
  error?: string;
}

interface FrameworkTestResult {
  name: string;
  url: string;
  error?: string;
  results: Record<string, SelectorResult>;
}

// ─── Framework selector presets ─────────────────────────────────────────────

const FRAMEWORK_PRESETS: Record<string, FrameworkSelectors> = {
  mintlify: {
    searchSelector: '#search-bar-entry, #search-bar-entry-mobile, [class*="search"]',
    copyButtonSelector: '[class*="copy"], button[aria-label*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], #navbar, #sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '#table-of-contents, [data-testid="table-of-contents"], [class*="table-of-contents"], [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  docusaurus: {
    searchSelector: '.DocSearch, .DocSearch-Button',
    copyButtonSelector: 'button.clean-btn[aria-label*="copy" i], button[class*="copyButton"]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .navbar, .sidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '.tabs[role="tablist"], [class*="tabs"]',
    tocSelector: '.table-of-contents, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  nextra: {
    searchSelector: '.nextra-search input, input[placeholder*="search" i], button[aria-label*="search" i]',
    copyButtonSelector: 'button[class*="copy"], button[aria-label*="copy" i], button[title*="copy" i]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], [class*="footer"]',
    contentSelector: 'main, article, [role="main"], [class*="content"]',
    tabContainerSelector: '[role="tablist"], [class*="tab"]',
    tocSelector: '.nextra-toc, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  'mkdocs-material': {
    searchSelector: '.md-search__input',
    copyButtonSelector: '.md-clipboard, .md-code__button[title="Copy to clipboard"]',
    codeBlockSelector: 'pre, code, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .md-nav, .md-sidebar',
    footerSelector: 'footer, [role="contentinfo"], .md-footer',
    contentSelector: 'main, article, [role="main"], .md-content',
    tabContainerSelector: '.tabbed-labels, .md-typeset .tabbed-set',
    tocSelector: '.md-sidebar--secondary .md-nav, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
  vitepress: {
    searchSelector: '.VPNavBarSearch button, .VPNavBarSearchButton, #local-search',
    copyButtonSelector: '.vp-code-copy, button.copy[title*="Copy"]',
    codeBlockSelector: 'pre, [class*="code"]',
    navigationSelector: 'nav, [role="navigation"], .VPNav, .VPSidebar, [class*="nav"], [class*="sidebar"]',
    footerSelector: 'footer, [role="contentinfo"], .VPFooter, [class*="footer"]',
    contentSelector: 'main, article, [role="main"], .VPContent, [class*="content"]',
    tabContainerSelector: '.vp-code-group .tabs, [role="tablist"]',
    tocSelector: '.VPDocAsideOutline, [class*="toc"]',
    feedbackSelector: '[class*="feedback"], [class*="helpful"]',
  },
};

// Real documentation sites for each framework.
// We pick a page with code blocks so copyButton and codeBlock selectors have a chance.
const TEST_SITES: Record<string, string> = {
  mintlify:          'https://www.mintlify.com/docs/components/expandables',
  docusaurus:        'https://docusaurus.io/docs/next/swizzling',
  nextra:            'https://nextra.site/docs/docs-theme/start',
  'mkdocs-material': 'https://squidfunk.github.io/mkdocs-material/reference/admonitions',
  vitepress:         'https://vitepress.dev/guide/markdown',
};

const SELECTOR_KEYS: Array<keyof FrameworkSelectors> = [
  'searchSelector',
  'copyButtonSelector',
  'codeBlockSelector',
  'navigationSelector',
  'footerSelector',
  'contentSelector',
  'tabContainerSelector',
  'tocSelector',
  'feedbackSelector',
];

// Selectors listed here are not expected to match on every page of that
// framework and won't count as failures when they return 0 matches.
const OPTIONAL_SELECTORS: Partial<Record<string, Array<keyof FrameworkSelectors>>> = {
  docusaurus:  ['feedbackSelector'],
  nextra:      ['feedbackSelector'],
  vitepress:   ['feedbackSelector'],
};

// ─── Test runner ─────────────────────────────────────────────────────────────

async function testFramework(
  browser: Browser,
  name: string,
  url: string,
  selectors: FrameworkSelectors,
): Promise<FrameworkTestResult> {
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Extra wait for JS-rendered content
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.log(`\n❌ ${name} — failed to load ${url}: ${(err as Error).message}`);
    await page.close();
    return { name, url, error: (err as Error).message, results: {} };
  }

  const results = await page.evaluate(
    (sels: FrameworkSelectors, keys: Array<keyof FrameworkSelectors>) => {
      const out: Record<string, SelectorResult> = {};
      for (const key of keys) {
        const sel = sels[key];
        try {
          const els = document.querySelectorAll(sel);
          const first = els[0];
          out[key] = {
            matched: els.length,
            firstTag: first ? first.tagName.toLowerCase() : null,
            firstClasses: first ? first.className.toString().slice(0, 120) : null,
            firstId: (first as HTMLElement | undefined)?.id ?? null,
          };
        } catch (e) {
          out[key] = { matched: 0, error: (e as Error).message };
        }
      }
      return out;
    },
    selectors,
    SELECTOR_KEYS,
  );

  await page.close();
  return { name, url, results };
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('Launching browser…\n');
  const browser = await puppeteer.launch({ headless: true });

  const allResults: FrameworkTestResult[] = [];

  for (const name of Object.keys(FRAMEWORK_PRESETS)) {
    const url = TEST_SITES[name]!;
    const selectors = FRAMEWORK_PRESETS[name]!;
    process.stdout.write(`Testing ${name} (${url})… `);
    const result = await testFramework(browser, name, url, selectors);
    allResults.push(result);

    if (result.error) {
      console.log('LOAD ERROR');
      continue;
    }

    const optional = new Set(OPTIONAL_SELECTORS[name] ?? []);
    const required = SELECTOR_KEYS.filter(k => !optional.has(k));
    const pass = required.filter(k => (result.results[k]?.matched ?? 0) > 0).length;
    const total = required.length;
    console.log(`${pass}/${total} selectors matched`);
  }

  await browser.close();

  // Print detailed report
  console.log('\n' + '='.repeat(72));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(72));

  let grandPass = 0;
  let grandFail = 0;

  for (const { name, url, error, results } of allResults) {
    console.log(`\n┌─ ${name}`);
    console.log(`│  ${url}`);
    if (error) {
      console.log(`│  ❌ Load error: ${error}`);
      grandFail += SELECTOR_KEYS.filter(k => !(OPTIONAL_SELECTORS[name] ?? []).includes(k)).length;
      continue;
    }
    const optionalSet = new Set(OPTIONAL_SELECTORS[name] ?? []);
    for (const key of SELECTOR_KEYS) {
      const r = results[key]!;
      const ok = r.matched > 0;
      const isOptional = optionalSet.has(key);
      const icon = ok ? '✅' : isOptional ? '⚪' : '❌';
      if (ok) grandPass++;
      else if (!isOptional) grandFail++;
      let detail = `${r.matched} match(es)`;
      if (r.firstTag) detail += ` — first: <${r.firstTag}>`;
      if (r.firstId) detail += `#${r.firstId}`;
      if (r.firstClasses) detail += `.${r.firstClasses.split(' ')[0]}`;
      console.log(`│  ${icon} ${key.padEnd(22)} ${detail}`);
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed out of ${grandPass + grandFail}`);
  console.log('='.repeat(72));

  process.exit(grandFail > 0 ? 1 : 0);
})();
