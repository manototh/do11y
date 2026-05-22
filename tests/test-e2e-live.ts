/**
 * Do11y E2E live-site test runner.
 *
 * Tests the same live public documentation sites as test-live-sites.ts, but
 * with full E2E coverage: Puppeteer injects do11y.js via evaluateOnNewDocument,
 * steers each site through a realistic user journey, sends events to Axiom, and
 * validates that the expected event types arrived.
 *
 * Loads AXIOM_DOMAIN, AXIOM_TOKEN, AXIOM_DATASET from .env in this directory.
 * Run: npm run test-e2e-live
 *
 * Required (set in .env):
 *   AXIOM_DOMAIN  — e.g. api.axiom.co
 *   AXIOM_TOKEN   — API token with ingest + query permissions
 *   AXIOM_DATASET — Dataset name
 *
 * Optional:
 *   FRAMEWORKS    — comma-separated subset to run (default: all)
 *   SKIP_BUILD    — "1" skips the dist/do11y.js build step
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { execSync } from 'child_process';
import fs from 'fs';
import type { Browser, Page } from 'puppeteer';

const AXIOM_DOMAIN  = process.env.AXIOM_DOMAIN!;
const AXIOM_TOKEN   = process.env.AXIOM_TOKEN!;
const AXIOM_DATASET = process.env.AXIOM_DATASET!;
const SKIP_BUILD    = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSite {
  startUrl: string;
  secondUrl: string;
}

interface AxiomEvent {
  eventType?: string;
  testFramework?: string;
  [key: string]: unknown;
}

interface EventExpectation {
  min: number;
  max?: number; // when set, any count above this is a failure
}

// ─── Live site definitions ────────────────────────────────────────────────────

// Same sites as test-live-sites.ts. Pages are chosen for rich code blocks so
// copy-button, code-block, and TOC selectors all have something to match.
const LIVE_SITES: Record<string, LiveSite> = {
  mintlify: {
    startUrl:  'https://www.mintlify.com/docs/components/expandables',
    secondUrl: 'https://www.mintlify.com/docs/components/accordions',
  },
  docusaurus: {
    startUrl:  'https://docusaurus.io/docs/next/swizzling',
    secondUrl: 'https://docusaurus.io/docs/next/markdown-features',
  },
  nextra: {
    startUrl:  'https://nextra.site/docs/docs-theme/start',
    secondUrl: 'https://nextra.site/docs',                              // linked via breadcrumb; has expandable FAQ
  },
  'mkdocs-material': {
    startUrl:  'https://squidfunk.github.io/mkdocs-material/reference/admonitions',
    secondUrl: 'https://squidfunk.github.io/mkdocs-material/reference/icons-emojis/', // linked inline from admonitions
  },
  vitepress: {
    startUrl:  'https://vitepress.dev/guide/getting-started',
    secondUrl: 'https://vitepress.dev/guide/markdown',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string):  void { console.log(`\x1b[36m[runner]\x1b[0m ${msg}`); }
function warn(msg: string): void { console.log(`\x1b[33m[runner]\x1b[0m ${msg}`); }
function fail(msg: string): void { console.log(`\x1b[31m[runner]\x1b[0m ${msg}`); }
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ─── Script builder ───────────────────────────────────────────────────────────

/**
 * Returns a self-contained JS string that, when evaluated in a page context:
 *  1. Sets window.Do11yConfig so do11y picks up Axiom credentials.
 *  2. Wraps window.fetch to tag every ingest payload with testRunId and
 *     testFramework for later Axiom filtering.
 *  3. Runs the compiled do11y.js source.
 *
 * Used as the argument to page.evaluateOnNewDocument() so it executes before
 * any page scripts on every full navigation (including the second page).
 */
function buildPatchedScript(framework: string, testRunId: string): string {
  const src = fs.readFileSync(DO11Y_SRC, 'utf8');

  const configBlock = `window.Do11yConfig = {
  axiomHost: '${AXIOM_DOMAIN.trim()}',
  axiomDataset: '${AXIOM_DATASET.trim()}',
  axiomToken: '${AXIOM_TOKEN.trim()}',
  // Tells do11y which preset to load (tocSelector, copyButtonSelector, etc.)
  // so framework-specific selectors are correct on every live site.
  framework: '${framework}',
  debug: true,
  allowedDomains: null,
  // Lower threshold so headings visible for ≥1s are recorded;
  // the test sleeps 2s after page load which comfortably exceeds this.
  sectionVisibleThreshold: 1,
};\n`;

  const interceptBlock = `(function () {
  var _fetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && url.includes('/v1/ingest/') && opts && opts.body) {
      try {
        var events = JSON.parse(opts.body);
        events = events.map(function (e) {
          return Object.assign({}, e, {
            testRunId: '${testRunId}',
            testFramework: '${framework}',
          });
        });
        opts = Object.assign({}, opts, { body: JSON.stringify(events) });
      } catch (_e) { /* ignore */ }
    }
    return _fetch(url, opts);
  };
}());\n`;

  return configBlock + interceptBlock + src;
}

// ─── Build ────────────────────────────────────────────────────────────────────

function ensureBuild(): void {
  if (SKIP_BUILD) {
    log('SKIP_BUILD=1 — skipping build step');
    if (!fs.existsSync(DO11Y_SRC)) {
      fail('dist/do11y.js not found and SKIP_BUILD=1. Run `npm run build` in the repo root first.');
      process.exit(1);
    }
    return;
  }
  log('Building dist/do11y.js from source…');
  execSync('npm run build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  log('Build complete\n');
}

// ─── Puppeteer interaction scenarios ─────────────────────────────────────────

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const distance = 200;
      const delay = 80;

      // Some frameworks use container-based scrolling; find the scrollable element.
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
        const maxScroll  = container
          ? container.scrollHeight - container.clientHeight
          : document.body.scrollHeight - window.innerHeight;

        if (scrollPos >= maxScroll - 1) { clearInterval(timer); resolve(); }
      }, delay);
      setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
    });
  });
}

async function runInteractions(
  browser: Browser,
  framework: string,
  site: LiveSite,
  patchedScript: string,
): Promise<void> {
  const page = await browser.newPage();
  // 1440px wide ensures VitePress and other frameworks render the aside TOC panel.
  await page.setViewport({ width: 1440, height: 900 });

  // Inject do11y (config + fetch interceptor + source) before any page script.
  // evaluateOnNewDocument re-executes on every full navigation, so the second
  // page also gets do11y automatically with no extra wiring.
  await page.evaluateOnNewDocument(patchedScript);

  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(site.startUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  // Sleep 2s so headings in the initial viewport accumulate ≥1s of visibility
  // (matches sectionVisibleThreshold: 1 set in Do11yConfig above).
  await sleep(2000);

  // 2. Click a TOC link (toc_click)
  log('  → toc_click');
  const TOC_SELECTORS = [
    '#table-of-contents',
    '[data-testid="table-of-contents"]',
    '.table-of-contents',
    '.VPDocAsideOutline',
    '.md-sidebar--secondary .md-nav',
    '[class*="toc"]',
    '[class*="outline"]',
    '[class*="TableOfContents"]',
    'aside.toc',
  ];
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
      warn(`  ⚠ No TOC element found on ${framework}, skipping`);
    }
  } catch { /* ignore */ }
  await sleep(500);

  // 3. Scroll to bottom (scroll_depth + section_visible via IntersectionObserver exit)
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search element (search_opened)
  //    Uses Puppeteer's native page.click() to fire real pointer events, which
  //    more reliably triggers do11y's capture-phase document listener.
  log('  → search_opened');
  const SEARCH_SEL =
    '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
    '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
    'button[aria-label*="search" i]';
  try {
    await page.waitForSelector(SEARCH_SEL, { timeout: 3000 });
    await page.click(SEARCH_SEL);
  } catch { warn(`  ⚠ No search element found on ${framework}, skipping`); }
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button (code_copied).
  //    Frameworks like mkdocs-material and nextra hide copy buttons with
  //    opacity/pointer-events until the code block is hovered. Puppeteer's
  //    real mouse.move() fires actual mouseover/mouseenter events so the CSS
  //    transition fires and the button becomes interactive before we click.
  log('  → code_copied');
  try {
    // Scroll first <pre> into view and hover it to reveal hidden copy buttons.
    await page.evaluate(() => {
      document.querySelector('pre')?.scrollIntoView({ block: 'center' });
    });
    const preEl = await page.$('pre');
    if (preEl) {
      await preEl.hover();
      await sleep(400); // allow CSS transition to complete
    }

    const copyClicked = await page.evaluate(() => {
      const el = document.querySelector(
        'button.clean-btn[aria-label*="copy" i], button[class*="copyButton"], ' +
        '[class*="copy"], button[aria-label*="copy" i], button[title*="copy" i], ' +
        '.md-clipboard, .md-code__button[title="Copy to clipboard"], ' +
        '.vp-code-copy, button.copy[title*="Copy"]'
      );
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    });
    if (!copyClicked) warn(`  ⚠ No copy button found on ${framework}, skipping`);
  } catch { /* ignore */ }
  await sleep(500);

  // 6. Expand a <details> element (expand_collapse).
  //    Only native <details> elements represent documentation-level expandable
  //    content (Mintlify accordion components, mkdocs-material collapsible
  //    admonitions, etc.). We intentionally do not match [aria-expanded]
  //    sidebar nav buttons — those are structural UI, not content expandables.
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
    if (!expanded) warn(`  ⚠ No <details> element found on ${framework}, skipping`);
  } catch { /* ignore */ }
  await sleep(500);

  // 7. Click feedback widget (feedback).
  //    Scroll to bottom using container-aware logic so frameworks like Mintlify
  //    that scroll a <div> container — not the window — reach the feedback
  //    section. Then wait for the element to render before querying.
  log('  → feedback');
  try {
    await page.evaluate(() => {
      // Mirror the container-detection in autoScroll so the right element scrolls.
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

    // Wait for the feedback widget to appear (lazy-rendered on scroll) rather
    // than a fixed sleep. Falls through silently if absent on this framework.
    await page.waitForSelector(
      '#feedback-thumbs-up, #feedback-thumbs-down, button[data-md-value], .md-feedback',
      { timeout: 3000 },
    ).catch(() => { /* widget absent on this framework — handled below */ });

    const feedbackClicked = await page.evaluate(() => {
      // 1. Stable IDs: Mintlify renders #feedback-thumbs-up / #feedback-thumbs-down.
      const byId = document.querySelector('#feedback-thumbs-up, #feedback-thumbs-down');
      if (byId) { (byId as HTMLElement).click(); return true; }

      // 2. Data-attribute: mkdocs-material uses button[data-md-value].
      const byData = document.querySelector('button[data-md-value]');
      if (byData) { (byData as HTMLElement).click(); return true; }

      // 3. Known container selectors — click the first child button.
      const container = document.querySelector(
        '.md-feedback, [data-feedback], [class*="PageFeedback"], [class*="page-feedback"]'
      );
      if (container) {
        const btn = container.querySelector('button');
        if (btn) { (btn as HTMLElement).click(); return true; }
      }

      // 4. Text-based fallback: smallest element whose text mentions the prompt.
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
    if (!feedbackClicked) warn(`  ⚠ No feedback widget found on ${framework}, skipping`);
  } catch { /* ignore */ }
  await sleep(500);

  // 8. Click internal link to second page (link_click + page_view).
  //    We compare each anchor's resolved .href property (always an absolute URL
  //    in the DOM) rather than the raw href attribute, so relative hrefs like
  //    ../icons-emojis/ are matched correctly alongside absolute ones.
  log('  → link_click (internal) + page_view (second page)');
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
      warn(`  ⚠ Could not find nav link to ${secondPath}, navigating directly`);
      await page.goto(site.secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }
  } catch {
    await page.goto(site.secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  }
  await sleep(1500);

  // 9. Trigger page_exit.
  // page.close({ runBeforeUnload: true }) is the Puppeteer-idiomatic way to
  // guarantee beforeunload fires, which triggers flushSync() in do11y.
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  // Allow the keepalive fetch dispatched by flushSync() to complete.
  await sleep(2000);
}

// ─── Axiom query ──────────────────────────────────────────────────────────────

async function queryAxiom(testRunId: string, startTime: Date): Promise<AxiomEvent[]> {
  const apl  = `['${AXIOM_DATASET}'] | where testRunId == '${testRunId}' | order by _time asc`;
  const body = JSON.stringify({
    apl,
    startTime: startTime.toISOString(),
    endTime:   new Date().toISOString(),
  });

  const url = `https://${AXIOM_DOMAIN}/v1/query/_apl?format=tabular`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${AXIOM_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Axiom query failed (${res.status}): ${text}`);
  }

  const text = await res.text();
  let data: {
    tables?: Array<{ fields?: Array<{ name: string }>; columns?: unknown[][] }>;
    matches?: Array<{ _source?: AxiomEvent; data?: AxiomEvent }>;
  };
  try { data = JSON.parse(text); }
  catch { throw new Error(`Axiom returned non-JSON: ${text.slice(0, 500)}`); }

  const table = data.tables?.[0];
  if (table?.fields && table?.columns) {
    const fieldNames = table.fields.map(f => f.name);
    const numRows    = table.columns[0]?.length ?? 0;
    const rows: AxiomEvent[] = [];
    for (let j = 0; j < numRows; j++) {
      const obj: AxiomEvent = {};
      fieldNames.forEach((name, i) => { obj[name] = table.columns![i]?.[j]; });
      rows.push(obj);
    }
    return rows;
  }

  if (Array.isArray(data.matches)) {
    return data.matches.map(m => m._source ?? m.data ?? m as AxiomEvent);
  }

  return [];
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EXPECTED_EVENTS: Record<string, EventExpectation> = {
  page_view:       { min: 2 },
  scroll_depth:    { min: 1 },
  search_opened:   { min: 0 },   // best-effort — not all frameworks render search the same way
  code_copied:     { min: 1 },
  link_click:      { min: 1 },
  page_exit:       { min: 1 },
  expand_collapse: { min: 1 },
  toc_click:       { min: 1 },
  feedback:        { min: 0 },   // default best-effort; raised to 1 for sites with confirmed widgets
  section_visible: { min: 1 },
};

// Frameworks confirmed to have a page-level feedback widget on their test pages.
const FEEDBACK_REQUIRED = new Set(['mintlify', 'mkdocs-material']);

// Frameworks whose test pages have no documentation-level expandable content.
// expand_collapse events on these pages indicate a false positive in do11y
// (e.g. a sidebar nav toggle being mis-classified), so we assert max: 0.
const EXPAND_NONE = new Set(['nextra']);

function validateEvents(
  framework: string,
  events: AxiomEvent[],
): { pass: number; fail: number; lines: string[] } {
  const byType: Record<string, number> = {};
  for (const e of events) {
    if (e.eventType) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
  }

  let pass = 0;
  let failCount = 0;
  const lines: string[] = [];

  for (const [type, exp] of Object.entries(EXPECTED_EVENTS)) {
    const min = (type === 'feedback'        && FEEDBACK_REQUIRED.has(framework)) ? 1
              : (type === 'expand_collapse' && EXPAND_NONE.has(framework))       ? 0
              : exp.min;
    const max = (type === 'expand_collapse' && EXPAND_NONE.has(framework))       ? 0
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

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!AXIOM_DOMAIN || !AXIOM_TOKEN || !AXIOM_DATASET) {
    fail('Missing required env vars: AXIOM_DOMAIN, AXIOM_TOKEN, AXIOM_DATASET');
    process.exit(1);
  }

  ensureBuild();

  const testRunId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date();
  log(`Test run: ${testRunId}`);
  log(`Dataset:  ${AXIOM_DATASET}`);

  let siteNames = Object.keys(LIVE_SITES);
  if (process.env.FRAMEWORKS) {
    const requested = process.env.FRAMEWORKS.split(',').map(s => s.trim());
    siteNames = siteNames.filter(n => requested.includes(n));
  }
  log(`Frameworks: ${siteNames.join(', ')}\n`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer') as {
    launch: (opts: { headless: boolean; args?: string[] }) => Promise<Browser>;
  };
  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });

  const results: Record<string, { tested: boolean; error?: string }> = {};

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n${'─'.repeat(60)}`);
    log(`${name} → ${site.startUrl}`);
    console.log(`${'─'.repeat(60)}`);

    const patchedScript = buildPatchedScript(name, testRunId);

    try {
      await runInteractions(browser, name, site, patchedScript);
      log('  Interactions complete');
      results[name] = { tested: true };
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
      results[name] = { tested: true, error: (err as Error).message };
    }
  }

  await browser.close();

  log('\nWaiting 15s for Axiom ingest…');
  await sleep(15000);

  console.log(`\n${'='.repeat(60)}`);
  log('QUERYING AXIOM');
  console.log(`${'='.repeat(60)}`);

  let allEvents: AxiomEvent[];
  try {
    allEvents = await queryAxiom(testRunId, startTime);
    log(`Total events received: ${allEvents.length}\n`);
  } catch (err) {
    fail(`Axiom query failed: ${(err as Error).message}`);
    process.exit(1);
  }

  let grandPass = 0;
  let grandFail = 0;

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n┌─ ${name}`);
    console.log(`│  ${site.startUrl}`);

    const fwEvents = allEvents.filter(e => e.testFramework === name);
    console.log(`│  ${fwEvents.length} events ingested`);

    if (fwEvents.length === 0) {
      console.log(`│  ❌ No events found — do11y may not have loaded or ingest was blocked`);
      grandFail += Object.values(EXPECTED_EVENTS).filter(e => e.min > 0).length;
      continue;
    }

    const v = validateEvents(name, fwEvents);
    for (const line of v.lines) console.log(`│  ${line}`);
    grandPass += v.pass;
    grandFail += v.fail;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(grandFail > 0 ? 1 : 0);
})();
