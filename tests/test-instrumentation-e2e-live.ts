/**
 * Do11y instrumentation E2E live-site test runner.
 *
 * Tests DocsInstrumentation against production documentation sites by
 * injecting the test harness IIFE via evaluateOnNewDocument. Events are
 * sent to a Supabase table via the harness exporter and validated by
 * querying the REST API after all interactions complete.
 *
 * Run: npx tsx test-instrumentation-e2e-live.ts
 *
 * Required (.env in this directory):
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_KEY        — Publishable key (for client-side inserts via PostgREST)
 *   SUPABASE_SECRET_KEY — Secret key (for server-side reads via PostgREST)
 *   SUPABASE_TABLE      — Table name (default: do11y_events)
 *
 * Optional:
 *   FRAMEWORKS    — comma-separated subset to run (default: all)
 *   SKIP_BUILD    — "1" skips the test-harness build step
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { execSync } from 'child_process';
import fs from 'fs';
import type { Browser, Page } from 'puppeteer';

import {
  LIVE_SITES,
  type SupabaseRow,
  log,
  warn,
  fail,
} from './shared/frameworks.js';

import {
  EXPECTED_EVENTS,
  validateEventsLive,
  sleep,
  autoScroll,
  clickTocLink,
  clickSearch,
  clickCopyButton,
  expandDetails,
  clickFeedback,
} from './shared/interactions.js';

const HARNESS_SRC = path.resolve(__dirname, 'harness', 'do11y-test-harness.js');
const SKIP_BUILD = process.env.SKIP_BUILD === '1';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureBuild(): void {
  if (SKIP_BUILD) {
    log('SKIP_BUILD=1 — skipping build step');
    if (!fs.existsSync(HARNESS_SRC)) {
      fail(`Test harness not found and SKIP_BUILD=1. Run \`npm run build:test-harness\` first.`);
      process.exit(1);
    }
    return;
  }
  log('Building test harness…');
  execSync('npm run build:test-harness', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
  log('Build complete\n');
}

function buildPatchedHarness(framework: string, testRunId: string): string {
  const src = fs.readFileSync(HARNESS_SRC, 'utf8');
  const configBlock = `
window.__do11yTestSetConfig({
  framework: '${framework}',
  debug: false,
  sectionVisibleThreshold: 1,
  supabaseUrl: '${SUPABASE_URL}',
  supabaseKey: '${SUPABASE_KEY}',
  supabaseTable: '${SUPABASE_TABLE}',
  testRunId: '${testRunId}',
  testFramework: '${framework}',
});
window.__do11yTestInit();
`;
  return src + configBlock;
}

// ─── Live-site interaction sequence (instrumentation variant) ────────────────

async function runInstrumentedLiveInteractions(
  page: Page,
  framework: string,
  startUrl: string,
  secondUrl: string,
): Promise<void> {
  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);

  // 2. Click a TOC link
  log('  → toc_click');
  const tocClicked = await clickTocLink(page, 'data-do11y-test-toc');
  if (!tocClicked) warn(`  ⚠ No TOC element found on ${framework}, skipping`);
  await sleep(500);

  // 3. Scroll to bottom
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search element
  log('  → search_opened');
  try {
    const searchClicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
       '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
       'site-search button[data-open-modal], ' +
       'button[aria-label*="search" i], ' +
       '.td-search input, .td-search__input');
    if (!searchClicked) {
      await page.waitForSelector('#search-bar-entry, .DocSearch-Button', { timeout: 3000 }).catch(() => {});
    }
  } catch { warn(`  ⚠ No search element found on ${framework}, skipping`); }
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
    const copyClicked = await clickCopyButton(page);
    if (!copyClicked) warn(`  ⚠ No copy button found on ${framework}, skipping`);
  } catch (err) {
    warn(`  ⚠ Copy button interaction error on ${framework}: ${(err as Error).message}`);
  }
  await sleep(500);

  // 6. Expand a <details> element
  log('  → expand_collapse');
  const expanded = await expandDetails(page);
  if (!expanded) warn(`  ⚠ No <details> element found on ${framework}, skipping`);
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
  const secondPath = new URL(secondUrl).pathname.replace(/\/$/, '');
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
    } catch { /* fall through */ }
    if (!clicked) {
      warn(`  ⚠ Could not find nav link to ${secondPath}, navigating directly`);
      await page.goto(secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }
  } catch {
    await page.goto(secondUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  }
  await sleep(1500);

  // 9. Emit page_exit directly through the harness emitter. The sync XHR
  //    exporter guarantees delivery before the page closes.
  log('  → page_exit');
  await page.evaluate(() => window.__do11yTestEmitPageExit());
  await sleep(500);

  // 10. Close page.
  await page.close();
  await sleep(1000);
}

// ─── Supabase query ──────────────────────────────────────────────────────────

async function querySupabase(testRunId: string): Promise<SupabaseRow[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set('select', 'payload');
  url.searchParams.set('payload->>_testRunId', `eq.${testRunId}`);
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

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n${'─'.repeat(60)}`);
    log(`${name} → ${site.startUrl}`);
    console.log(`${'─'.repeat(60)}`);

    const patchedHarness = buildPatchedHarness(name, testRunId);

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument(patchedHarness);

      await runInstrumentedLiveInteractions(page, name, site.startUrl, site.secondUrl);
      log('  Interactions complete');
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
    }
  }

  await browser.close();

  // Wait for Supabase ingest
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

    const fwRows = allRows.filter(row => row.payload?._testFramework === name);
    console.log(`│  ${fwRows.length} events ingested`);

    if (fwRows.length === 0) {
      console.log(`│  ❌ No events found — instrumentation may not have loaded`);
      grandFail += Object.values(EXPECTED_EVENTS).filter(e => e.min > 0).length;
      continue;
    }

    const v = validateEventsLive(name, fwRows);
    for (const line of v.lines) console.log(`│  ${line}`);
    grandPass += v.pass;
    grandFail += v.fail;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(grandFail > 0 ? 1 : 0);
})();
