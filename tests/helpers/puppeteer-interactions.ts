/**
 * Do11y — Test Helpers
 *
 * Shared Puppeteer interaction sequence used by the integration tests.
 *
 * Extracted from the legacy test-e2e-live.ts and test-integrations.ts runners.
 * Provides a standard set of user interactions that exercise all tracking
 * modules: TOC clicks, scroll depth, search, code copy, expand/collapse,
 * feedback, link navigation, and page exit.
 */
import type { Page, Browser } from 'puppeteer';

// ─── Logging ─────────────────────────────────────────────────────────────────

export function log(msg: string):  void { console.log(`\x1b[36m[runner]\x1b[0m ${msg}`); }
export function warn(msg: string): void { console.log(`\x1b[33m[runner]\x1b[0m ${msg}`); }

// ─── Shared selectors (framework-agnostic) ───────────────────────────────────

export const TOC_SELECTORS = [
  '#table-of-contents',
  '[data-testid="table-of-contents"]',
  '.table-of-contents',
  '.VPDocAsideOutline',
  '.VPLocalNavOutlineDropdown',
  '.md-sidebar--secondary .md-nav',
  '.right-sidebar-panel',
  'starlight-toc',
  '.td-toc',
  'nav[id="TableOfContents"]',
  '[class*="toc"]',
  '[class*="TableOfContents"]',
  'aside.toc',
  'a.outline-link',
];

export const SEARCH_SELECTORS =
  '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
  '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
  'site-search button[data-open-modal], ' +
  'button[aria-label*="search" i], ' +
  '.td-search input, .td-search__input';

export const COPY_BUTTON_SELECTORS = [
  'button.clean-btn[aria-label*="copy" i]',
  'button[class*="copyButton"]',
  'button[aria-label*="copy" i]',
  'button[title*="copy" i]',
  '.td-click-to-copy',
  'button.fa-copy',
  '.md-clipboard',
  '.md-code__button[title="Copy to clipboard"]',
  '.vp-code-copy',
  'button.copy[title*="Copy"]',
  '.expressive-code .copy button',
].join(', ');

// ─── Configuration for an interaction run ────────────────────────────────────

export interface InteractionConfig {
  /** The URL/path of the guide/second page for link navigation. */
  guidePath: string;
  /** Timeout for page loads (ms). */
  pageLoadTimeout?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Auto-scroll a page from top to bottom. Detects scrollable containers
 * within the main content area for frameworks that use overflow containers
 * (e.g., MkDocs Material, VitePress).
 */
export async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const distance = 200;
      const delay = 80;

      let container: Element | null = null;
      const contentEl = document.querySelector('[role="main"], main, article');
      if (contentEl) {
        let el: Element | null = contentEl;
        while (el && el !== document.body && el !== document.documentElement) {
          const style = window.getComputedStyle(el);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
              el.scrollHeight > el.clientHeight) {
            container = el;
            break;
          }
          el = el.parentElement;
        }
      }

      const timer = setInterval(() => {
        if (container) { (container as HTMLElement).scrollTop += distance; }
        else { window.scrollBy(0, distance); }

        const scrollPos = container ? container.scrollTop : window.scrollY;
        const maxScroll = container
          ? container.scrollHeight - container.clientHeight
          : document.body.scrollHeight - window.innerHeight;

        if (scrollPos >= maxScroll - 1) { clearInterval(timer); resolve(); }
      }, delay);
      setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
    });
  });
}

// ─── Interaction sequence ────────────────────────────────────────────────────

/**
 * Run the standard do11y interaction sequence on a page.
 *
 * Performs (in order):
 *   1. Wait for initial page render
 *   2. Click a TOC link          → toc_click
 *   3. Scroll to bottom           → scroll_depth (multiple thresholds)
 *   4. Click search element        → search_opened
 *   5. Click copy button           → code_copied
 *   6. Expand a <details> element  → expand_collapse
 *   7. Click feedback widget       → feedback
 *   8. Navigate to guide page      → link_click + page_view (second page)
 *   9. Click TOC on guide page    → toc_click (second page)
 *  10. Flush events and close     → page_exit
 *
 * @param page     - Puppeteer page (must already have do11y injected)
 * @param config   - Interaction config (guide path, timeouts)
 */
export async function runInteractions(
  page: Page,
  config: InteractionConfig,
): Promise<void> {
  const timeout = config.pageLoadTimeout ?? 30000;

  // 1. Initial wait for JS-rendered content
  await sleep(2000);

  // 2. Click a TOC link
  log('  → toc_click');
  try {
    const found = await page.evaluate((sels: string[]) => {
      for (const sel of sels) {
        const toc = document.querySelector(sel);
        if (!toc) continue;
        const link = toc.querySelector('a[href^="#"]');
        if (!link) continue;
        link.setAttribute('data-do11y-test-toc', '1');
        return true;
      }
      return false;
    }, TOC_SELECTORS);
    if (found) {
      await page.click('[data-do11y-test-toc]');
    } else {
      warn('  ⚠ No TOC element found, skipping');
    }
  } catch { /* ignore */ }
  await sleep(500);

  // 3. Scroll to bottom
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search element
  log('  → search_opened');
  try {
    const clicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, SEARCH_SELECTORS);
    if (!clicked) warn('  ⚠ No search element found, skipping');
  } catch { warn('  ⚠ Search interaction failed, skipping'); }
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button
  log('  → code_copied');
  try {
    await page.evaluate(() => {
      document.querySelector('pre')?.scrollIntoView({ block: 'center' });
    }).catch(() => {});
    try {
      const preEl = await page.$('pre');
      if (preEl) {
        await preEl.hover().catch(() => {});
        await sleep(400);
      }
    } catch { /* hover non-fatal */ }

    const copyClicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, COPY_BUTTON_SELECTORS);
    if (!copyClicked) warn('  ⚠ No copy button found, skipping');
  } catch (err) {
    warn(`  ⚠ Copy button interaction error: ${(err as Error).message}`);
  }
  await sleep(500);

  // 6. Expand a <details> element
  log('  → expand_collapse');
  try {
    const expanded = await page.evaluate(() => {
      const details = document.querySelector('details:not([open])');
      if (details) {
        const summary = details.querySelector('summary');
        if (summary) { summary.click(); return true; }
      }
      return false;
    });
    if (!expanded) warn('  ⚠ No <details> element found, skipping');
  } catch { /* ignore */ }
  await sleep(500);

  // 7. Click feedback widget
  log('  → feedback');
  try {
    await page.evaluate(() => {
      const contentEl = document.querySelector('[role="main"], main, article');
      let container: Element | null = null;
      if (contentEl) {
        let el: Element | null = contentEl;
        while (el && el !== document.body && el !== document.documentElement) {
          const style = window.getComputedStyle(el);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
              el.scrollHeight > el.clientHeight) {
            container = el;
            break;
          }
          el = el.parentElement;
        }
      }
      if (container) { (container as HTMLElement).scrollTop = container.scrollHeight; }
      else { window.scrollTo(0, document.body.scrollHeight); }
    });

    const feedbackClicked = await page.evaluate(() => {
      const candidates = document.querySelectorAll(
        '[class*="feedback"], [class*="helpful"], [data-feedback], ' +
        '#feedback-thumbs-up, #feedback-thumbs-down'
      );
      for (const el of candidates) {
        if (el.tagName === 'BUTTON') {
          (el as HTMLElement).click(); return true;
        }
        const btn = el.querySelector('button');
        if (btn) { (btn as HTMLElement).click(); return true; }
      }
      return false;
    });
    if (!feedbackClicked) warn('  ⚠ No feedback widget found, skipping');
  } catch { /* ignore */ }
  await sleep(500);

  // 8. Navigate to guide page (link_click + second page_view)
  log('  → link_click (internal) + page_view (guide)');
  try {
    const gp = config.guidePath;
    // Extract the bare filename from the guide path (e.g. "mintlify-guide.html")
    // so we can match both absolute and relative href variants.
    const relHref = gp.split('/').pop() || gp;
    const relPath = gp.startsWith('/') ? gp.slice(1) : gp;
    const linkSel = [gp, `./${relHref}`, relHref, `${gp}.html`, `${gp}/`, relPath, `${relPath}.html`, `${relPath}/`, `${relPath}.md`]
      .map((h) => `a[href="${h}"]`).join(', ');

    // Try clicking a matching link
    try {
      await page.waitForSelector(linkSel, { timeout: 5000 });
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ block: 'center' });
      }, linkSel);
      await sleep(300);
      await Promise.all([
        page.click(linkSel),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout }).catch(() => {}),
      ]);
    } catch {
      // Fallback: click any link whose href ends with the guide path
      const found = await page.evaluate((targetPath: string) => {
        for (const a of Array.from(document.querySelectorAll('a[href]'))) {
          try {
            const href = (a as HTMLAnchorElement).href;
            if (href.endsWith(targetPath) || href.endsWith(targetPath + '/')) {
              (a as HTMLElement).setAttribute('data-do11y-test-nav', '1');
              return true;
            }
          } catch { /* ignore unparseable hrefs */ }
        }
        return false;
      }, gp);

      if (found) {
        await page.evaluate(() => {
          document.querySelector('[data-do11y-test-nav]')?.scrollIntoView({ block: 'center' });
        });
        await sleep(300);
        await Promise.all([
          page.click('[data-do11y-test-nav]'),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout }).catch(() => {}),
        ]);
      } else {
        warn(`  ⚠ Could not find nav link to ${gp}, navigating directly`);
        await page.goto(gp, { waitUntil: 'networkidle2', timeout });
      }
    }
  } catch {
    warn(`  ⚠ Navigation to guide page failed, continuing`);
  }
  await sleep(1500);

  // 9. Click a TOC link on the guide page
  log('  → toc_click (guide page)');
  try {
    const found = await page.evaluate((sels: string[]) => {
      for (const sel of sels) {
        const toc = document.querySelector(sel);
        if (!toc) continue;
        const link = toc.querySelector('a[href^="#"], a.outline-link[href*="#"]');
        if (!link) continue;
        link.setAttribute('data-do11y-test-toc-guide', '1');
        return true;
      }
      return false;
    }, TOC_SELECTORS);
    if (found) {
      await page.click('[data-do11y-test-toc-guide]');
    } else {
      warn('  ⚠ No TOC element found on guide page, skipping');
    }
  } catch { /* ignore */ }
  await sleep(500);

  // 10. Trigger page_exit
  log('  → page_exit');
  await page.evaluate(() => { (window as any).Do11y?.flush(); }).catch(() => {});
  await sleep(500);
  await page.close({ runBeforeUnload: true });
  await sleep(2000);
}
