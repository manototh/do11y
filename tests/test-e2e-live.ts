/**
 * Do11y E2E live-site test runner.
 *
 * Tests the same live public documentation sites as test-live-sites.ts, but
 * with full E2E coverage: Puppeteer injects do11y.js via evaluateOnNewDocument,
 * steers each site through a realistic user journey, sends events to Supabase,
 * and validates that the expected event types arrived.
 *
 * Loads SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY, SUPABASE_TABLE from .env in this directory.
 * Run: npm run test-e2e-live
 *
 * Required (set in .env):
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_KEY        — Publishable key (for client-side inserts via PostgREST)
 *   SUPABASE_SECRET_KEY — Secret key (for server-side reads via PostgREST)
 *   SUPABASE_TABLE      — Table name
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

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const SKIP_BUILD     = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSite {
  startUrl: string;
  secondUrl: string;
}

interface SupabaseRow {
  payload: {
    eventType?: string;
    testFramework?: string;
    testRunId?: string;
    [key: string]: unknown;
  };
}

interface EventExpectation {
  min: number;
  max?: number;
}

// ─── Live site definitions ────────────────────────────────────────────────────

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
    secondUrl: 'https://nextra.site/docs',
  },
  'mkdocs-material': {
    startUrl:  'https://squidfunk.github.io/mkdocs-material/reference/admonitions',
    secondUrl: 'https://squidfunk.github.io/mkdocs-material/reference/icons-emojis/',
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

function buildPatchedScript(framework: string, testRunId: string): string {
  const src = fs.readFileSync(DO11Y_SRC, 'utf8');

  const configBlock = `window.Do11yConfig = {
  supabaseUrl: '${SUPABASE_URL.trim()}',
  supabaseKey: '${SUPABASE_KEY.trim()}',
  supabaseTable: '${SUPABASE_TABLE.trim()}',
  framework: '${framework}',
  debug: true,
  allowedDomains: null,
  sectionVisibleThreshold: 1,
};\n`;

  const interceptBlock = `(function () {
  var _fetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && url.includes('/rest/v1/') && opts && opts.body) {
      try {
        var rows = JSON.parse(opts.body);
        if (Array.isArray(rows)) {
          rows = rows.map(function (r) {
            if (r.payload) {
              r.payload.testRunId = '${testRunId}';
              r.payload.testFramework = '${framework}';
            }
            return r;
          });
          opts = Object.assign({}, opts, { body: JSON.stringify(rows) });
        }
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
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(patchedScript);

  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(site.startUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);

  // 2. Click a TOC link (toc_click)
  log('  → toc_click');
  const TOC_SELECTORS = [
    '#table-of-contents',
    '[data-testid="table-of-contents"]',
    '.table-of-contents',
    '.VPDocAsideOutline',
    '.VPLocalNavOutlineDropdown',
    '.md-sidebar--secondary .md-nav',
    '[class*="toc"]',
    '[class*="TableOfContents"]',
    'aside.toc',
    'a.outline-link',
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

  // 3. Scroll to bottom
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search element
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

  // 5. Click copy button
  log('  → code_copied');
  try {
    await page.evaluate(() => {
      document.querySelector('pre')?.scrollIntoView({ block: 'center' });
    });
    const preEl = await page.$('pre');
    if (preEl) {
      await preEl.hover();
      await sleep(400);
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
    if (!expanded) warn(`  ⚠ No <details> element found on ${framework}, skipping`);
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
    if (!feedbackClicked) warn(`  ⚠ No feedback widget found on ${framework}, skipping`);
  } catch { /* ignore */ }
  await sleep(500);

  // 8. Click internal link to second page
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

  // 9. Trigger page_exit
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  await sleep(2000);
}

// ─── Supabase query ──────────────────────────────────────────────────────────

async function querySupabase(testRunId: string): Promise<SupabaseRow[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set('select', 'payload');
  url.searchParams.set('payload->>testRunId', `eq.${testRunId}`);
  url.searchParams.set('limit', '10000');

  const res = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_SECRET_KEY,
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }

  return await res.json() as SupabaseRow[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EXPECTED_EVENTS: Record<string, EventExpectation> = {
  page_view:       { min: 2 },
  scroll_depth:    { min: 1 },
  search_opened:   { min: 0 },
  code_copied:     { min: 1 },
  link_click:      { min: 1 },
  page_exit:       { min: 1 },
  expand_collapse: { min: 1 },
  toc_click:       { min: 1 },
  feedback:        { min: 0 },
  section_visible: { min: 1 },
};

const FEEDBACK_REQUIRED = new Set(['mintlify', 'mkdocs-material']);
const EXPAND_NONE = new Set(['nextra']);

function validateEvents(
  framework: string,
  rows: SupabaseRow[],
): { pass: number; fail: number; lines: string[] } {
  const byType: Record<string, number> = {};
  for (const row of rows) {
    const eventType = row.payload?.eventType;
    if (eventType) byType[eventType] = (byType[eventType] ?? 0) + 1;
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
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SECRET_KEY) {
    fail('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY');
    process.exit(1);
  }

  ensureBuild();

  const testRunId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  log(`Test run: ${testRunId}`);
  log(`Table:    ${SUPABASE_TABLE}`);

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

  log('\nWaiting 5s for Supabase ingest…');
  await sleep(5000);

  console.log(`\n${'='.repeat(60)}`);
  log('QUERYING SUPABASE');
  console.log(`${'='.repeat(60)}`);

  let allRows: SupabaseRow[];
  try {
    allRows = await querySupabase(testRunId);
    log(`Total events received: ${allRows.length}\n`);
  } catch (err) {
    fail(`Supabase query failed: ${(err as Error).message}`);
    process.exit(1);
  }

  let grandPass = 0;
  let grandFail = 0;

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n┌─ ${name}`);
    console.log(`│  ${site.startUrl}`);

    const fwRows = allRows.filter(row => row.payload?.testFramework === name);
    console.log(`│  ${fwRows.length} events ingested`);

    if (fwRows.length === 0) {
      console.log(`│  ❌ No events found — do11y may not have loaded or ingest was blocked`);
      grandFail += Object.values(EXPECTED_EVENTS).filter(e => e.min > 0).length;
      continue;
    }

    const v = validateEvents(name, fwRows);
    for (const line of v.lines) console.log(`│  ${line}`);
    grandPass += v.pass;
    grandFail += v.fail;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(grandFail > 0 ? 1 : 0);
})();
