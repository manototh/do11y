/**
 * Do11y — shared Puppeteer interaction sequences and validation.
 *
 * Provides the standard interaction flow, CSS selectors, event
 * expectations, and validation functions shared by both standalone
 * and instrumentation test suites (integration and E2E live-site tests).
 */

import type { Browser, Page } from 'puppeteer';
import type { Framework, LiveSite } from './frameworks.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EventExpectation {
  min: number;
  max?: number;
}

export interface SupabaseRow {
  payload: {
    eventName?: string;
    testFramework?: string;
    testRunId?: string;
    [key: string]: unknown;
  };
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export const TOC_SELECTORS = [
  '#table-of-contents',
  '[data-testid="table-of-contents"]',
  '.table-of-contents',            // Docusaurus
  '.VPDocAsideOutline',            // VitePress
  '.VPLocalNavOutlineDropdown',    // VitePress
  '.md-sidebar--secondary .md-nav', // MkDocs Material
  '.right-sidebar-panel',          // Starlight
  'starlight-toc',                 // Starlight (custom element)
  '.td-toc',                       // Docsy
  'nav[id="TableOfContents"]',    // Docsy
  '[class*="toc"]',
  '[class*="TableOfContents"]',
  'aside.toc',
  'a.outline-link',
];

export const SEARCH_SEL =
  '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
  '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
  'site-search button[data-open-modal], ' +
  'button[aria-label*="search" i], ' +
  '.td-search input, .td-search__input';

export const COPY_BTN_SEL = [
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

// ─── Event expectations ─────────────────────────────────────────────────────

export const EXPECTED_EVENTS: Record<string, EventExpectation> = {
  'browser.do11y.page_view':       { min: 2 },
  'browser.do11y.scroll_depth':    { min: 1 },
  'browser.do11y.search_opened':   { min: 0 },
  'browser.do11y.code_copied':     { min: 1 },
  'browser.do11y.link_click':      { min: 1 },
  'browser.do11y.page_exit':       { min: 1 },
  'browser.do11y.expand_collapse': { min: 1 },
  'browser.do11y.toc_click':       { min: 1 },
  'browser.do11y.feedback':        { min: 0 },
  'browser.do11y.section_visible': { min: 1 },
};

// Frameworks confirmed to have a page-level feedback widget on their test pages.
export const FEEDBACK_REQUIRED = new Set(['mkdocs-material']);

// Frameworks whose test pages have no documentation-level expandable content.
export const EXPAND_NONE = new Set(['nextra', 'docsy-dev']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Auto-scroll the page from top to bottom in steps.
 * Detects scrollable containers for frameworks that use them.
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

        if (scrollPos >= maxScroll - 1) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
      setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
    });
  });
}

/**
 * Click the TOC link found on the current page.
 * Returns true if a TOC was found and clicked.
 */
export async function clickTocLink(page: Page, attrName: string): Promise<boolean> {
  try {
    const found = await page.evaluate((sels: string[], attr: string) => {
      for (const sel of sels) {
        const toc = document.querySelector(sel);
        if (!toc) continue;
        const link = toc.querySelector('a[href^="#"]');
        if (!link) continue;
        link.setAttribute(attr, '1');
        return true;
      }
      return false;
    }, TOC_SELECTORS, attrName);
    if (found) {
      await page.click(`[${attrName}]`);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Click a search element on the current page.
 */
export async function clickSearch(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(SEARCH_SEL, { timeout: 3000 });
    await page.click(SEARCH_SEL);
    return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Click a code-copy button on the current page.
 */
export async function clickCopyButton(page: Page): Promise<boolean> {
  try {
    const copyClicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, COPY_BTN_SEL);
    return copyClicked;
  } catch { /* ignore */ }
  return false;
}

/**
 * Expand the first collapsed <details> element on the current page.
 */
export async function expandDetails(page: Page): Promise<boolean> {
  try {
    const expanded = await page.evaluate(() => {
      const details = document.querySelector('details:not([open])');
      if (details) {
        const summary = details.querySelector('summary');
        if (summary) { summary.click(); return true; }
      }
      return false;
    });
    return expanded;
  } catch { /* ignore */ }
  return false;
}

/**
 * Click a feedback widget on the current page.
 */
export async function clickFeedback(page: Page): Promise<boolean> {
  try {
    const feedbackClicked = await page.evaluate(() => {
      const candidates = document.querySelectorAll(
        '[class*="feedback"], [class*="helpful"], [data-feedback]'
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
    return feedbackClicked;
  } catch { /* ignore */ }
  return false;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate events from Supabase rows against expected counts.
 */
export function validateEvents(
  framework: string,
  rows: SupabaseRow[],
): { pass: number; fail: number; lines: string[]; total: number } {
  const byType: Record<string, number> = {};
  for (const row of rows) {
    const eventName = row.payload?.eventName;
    if (eventName) byType[eventName] = (byType[eventName] ?? 0) + 1;
  }

  let pass = 0;
  let failCount = 0;
  const lines: string[] = [];

  void framework;
  for (const [type, { min }] of Object.entries(EXPECTED_EVENTS)) {
    const count = byType[type] ?? 0;
    const ok = count >= min;
    if (ok) pass++; else failCount++;
    const icon = ok ? '✅' : (min === 0 ? '⚠️' : '❌');
    lines.push(`    ${icon} ${type.padEnd(18)} ${count} event(s) (expected ≥${min})`);
  }

  return { pass, fail: failCount, lines, total: rows.length };
}

/**
 * Validate events from Supabase rows against expected counts,
 * with per-framework adjustments (feedback required, expand forbidden).
 * Used by the E2E live-site test runner.
 */
export function validateEventsLive(
  framework: string,
  rows: SupabaseRow[],
): { pass: number; fail: number; lines: string[] } {
  const byType: Record<string, number> = {};
  for (const row of rows) {
    const eventName = row.payload?.eventName;
    if (eventName) byType[eventName] = (byType[eventName] ?? 0) + 1;
  }

  let pass = 0;
  let failCount = 0;
  const lines: string[] = [];

  for (const [type, exp] of Object.entries(EXPECTED_EVENTS)) {
    const min = (type === 'browser.do11y.feedback'        && FEEDBACK_REQUIRED.has(framework)) ? 1
              : (type === 'browser.do11y.expand_collapse' && EXPAND_NONE.has(framework))       ? 0
              : exp.min;
    const max = (type === 'browser.do11y.expand_collapse' && EXPAND_NONE.has(framework))       ? 0
              : exp.max;
    const count = byType[type] ?? 0;
    const ok    = count >= min && (max === undefined || count <= max);
    if (ok) pass++; else failCount++;
    const expectStr = max !== undefined ? `=${max}` : `≥${min}`;
    const icon = ok ? '✅' : (min === 0 && max === undefined ? '⚠️' : '❌');
    lines.push(`    ${icon} ${type.padEnd(18)} ${count} event(s) (expected ${expectStr})`);
  }

  return { pass, fail: failCount, lines };
}

// ─── Standalone integration interaction sequence ────────────────────────────

/**
 * Full Puppeteer interaction sequence for standalone integration tests.
 * Drives a browser through page views, scrolling, search, copy, expand,
 * feedback, link click, and page exit — validating events are queued.
 */
export async function runInteractions(
  browser: Browser,
  baseUrl: string,
  fw: Framework,
): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Page view on start page
  console.log('  → page_view (start page)');
  await page.goto(`${baseUrl}${fw.startPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  // 2. Click a TOC link
  console.log('  → toc_click');
  const tocClicked = await clickTocLink(page, 'data-do11y-test-toc');
  if (!tocClicked) console.log('  ⚠ No TOC element found, skipping');
  await sleep(500);

  // 3. Scroll to bottom
  console.log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search
  console.log('  → search_opened');
  const searchClicked = await clickSearch(page);
  if (!searchClicked) console.log('  ⚠ No search element found, skipping');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button
  console.log('  → code_copied');
  const copyClicked = await clickCopyButton(page);
  if (!copyClicked) console.log('  ⚠ No copy button found, skipping');
  await sleep(500);

  // 6. Expand a <details> element
  console.log('  → expand_collapse');
  const expanded = await expandDetails(page);
  if (!expanded) console.log('  ⚠ No <details> element found, skipping');
  await sleep(500);

  // 7. Click feedback button
  console.log('  → feedback');
  const feedbackClicked = await clickFeedback(page);
  if (!feedbackClicked) console.log('  ⚠ No feedback widget found, skipping');
  await sleep(500);

  // 8. Click internal link to guide page
  console.log('  → link_click (internal) + page_view (guide)');
  try {
    const gp = fw.guidePage;
    const relPath = gp.startsWith('/') ? gp.slice(1) : gp;
    const linkSel = [gp, `${gp}.html`, `${gp}/`, relPath, `${relPath}.html`, `${relPath}/`, `${relPath}.md`]
      .map((h) => `a[href="${h}"]`).join(', ');
    await page.waitForSelector(linkSel, { timeout: 10000 });
    await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'center' });
    }, linkSel);
    await sleep(300);
    await Promise.all([
      page.click(linkSel),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    ]);
  } catch {
    await page.goto(`${baseUrl}${fw.guidePage}`, { waitUntil: 'networkidle2', timeout: 15000 });
  }
  await sleep(1500);

  // 8b. Click a TOC link on the guide page (validates per-page outline tracking)
  console.log('  → toc_click (guide page)');
  const guideTocClicked = await clickTocLink(page, 'data-do11y-test-toc-guide');
  if (!guideTocClicked) console.log('  ⚠ No TOC element found on guide page, skipping');
  await sleep(500);

  // 9. Trigger page_exit
  console.log('  → page_exit');
  // Explicitly flush any remaining events before closing, as Puppeteer's
  // page.close({ runBeforeUnload: true }) may destroy the network context
  // before the keepalive fetch completes.
  await page.evaluate(() => { (window as any).Do11y?.flush(); }).catch(() => {});
  await sleep(500);
  await page.close({ runBeforeUnload: true });
  await sleep(2000);
}

// ─── E2E live-site interaction sequence ─────────────────────────────────────

/**
 * Full Puppeteer interaction sequence for standalone E2E live-site tests.
 * Injects the patched script via evaluateOnNewDocument, then drives the
 * browser through the same interaction sequence against production sites.
 */
export async function runInteractionsLive(
  browser: Browser,
  framework: string,
  site: LiveSite,
  patchedScript: string,
): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(patchedScript);

  // 1. Page view on start page
  console.log('  → page_view (start page)');
  await page.goto(site.startUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);

  // 2. Click a TOC link (toc_click)
  console.log('  → toc_click');
  const tocClicked = await clickTocLink(page, 'data-do11y-test-toc');
  if (!tocClicked) console.log(`  ⚠ No TOC element found on ${framework}, skipping`);
  await sleep(500);

  // 3. Scroll to bottom
  console.log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search element
  console.log('  → search_opened');
  // For live sites, try evaluate-based click first, then fall back to waitForSelector
  try {
    const searchClicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, SEARCH_SEL);
    if (!searchClicked) {
      await page.waitForSelector(SEARCH_SEL, { timeout: 3000 });
      await page.click(SEARCH_SEL);
    }
  } catch { console.log(`  ⚠ No search element found on ${framework}, skipping`); }
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button
  console.log('  → code_copied');
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

    const copyClicked = await clickCopyButton(page);
    if (!copyClicked) console.log(`  ⚠ No copy button found on ${framework}, skipping`);
  } catch (err) {
    console.log(`  ⚠ Copy button interaction error on ${framework}: ${(err as Error).message}`);
  }
  await sleep(500);

  // 6. Expand a <details> element
  console.log('  → expand_collapse');
  const expanded = await expandDetails(page);
  if (!expanded) console.log(`  ⚠ No <details> element found on ${framework}, skipping`);
  await sleep(500);

  // 7. Click feedback widget
  console.log('  → feedback');
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

    await page.waitForSelector(
      '#feedback-thumbs-up, #feedback-thumbs-down, button[data-md-value], .md-feedback',
      { timeout: 3000 },
    ).catch(() => {});

    const feedbackClicked = await page.evaluate(() => {
      const byId = document.querySelector('#feedback-thumbs-up, #feedback-thumbs-down');
      if (byId) { (byId as HTMLElement).click(); return true; }

      const byData = document.querySelector('button[data-md-value]');
      if (byData) { (byData as HTMLElement).click(); return true; }

      const container = document.querySelector(
        '.md-feedback, [data-feedback], [class*="PageFeedback"], [class*="page-feedback"]'
      );
      if (container) {
        const btn = container.querySelector('button');
        if (btn) { (btn as HTMLElement).click(); return true; }
      }

      const candidates = Array.from(document.querySelectorAll('form, section, div, footer, aside'));
      for (const el of candidates) {
        const text = el.textContent?.toLowerCase() ?? '';
        if (
          (text.includes('was this page') || text.includes('helpful?') || text.includes('page helpful')) &&
          text.length < 600
        ) {
          const btn = el.querySelector('button');
          if (btn) { (btn as HTMLElement).click(); return true; }
        }
      }
      return false;
    });
    if (!feedbackClicked) console.log(`  ⚠ No feedback widget found on ${framework}, skipping`);
  } catch { /* ignore */ }
  await sleep(500);

  // 8. Click internal link to second page
  console.log('  → link_click (internal) + page_view (second page)');
  const secondPath = new URL(site.secondUrl).pathname.replace(/\/$/, '');

  try {
    let clicked = false;
    try {
      const found = await page.evaluate((targetPath: string) => {
        for (const a of Array.from(document.querySelectorAll('a[href]'))) {
          try {
            const resolved = new URL((a as HTMLAnchorElement).href);
            if (resolved.pathname.replace(/\/$/, '') === targetPath) {
              (a as HTMLElement).setAttribute('data-do11y-test-nav', '1');
              return true;
            }
          } catch { /* ignore unparseable hrefs */ }
        }
        return false;
      }, secondPath);

      if (found) {
        await page.evaluate(() => {
          document.querySelector('[data-do11y-test-nav]')?.scrollIntoView({ block: 'center' });
        });
        await sleep(300);
        await Promise.all([
          page.click('[data-do11y-test-nav]'),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        ]);
        clicked = true;
      }
    } catch { /* fall through to direct navigation */ }

    if (!clicked) {
      console.log(`  ⚠ Could not find nav link to ${secondPath}, navigating directly`);
      await page.goto(site.secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }
  } catch {
    await page.goto(site.secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  }
  await sleep(1500);

  // 9. Trigger page_exit
  console.log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  await sleep(2000);
}
