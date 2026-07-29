/**
 * Do11y instrumentation E2E live-site test runner.
 *
 * Tests DocsInstrumentation against production documentation sites by
 * injecting the test harness IIFE via evaluateOnNewDocument. Events are
 * captured in-memory via an OTel InMemoryLogRecordExporter — no Supabase
 * credentials needed for pass/fail validation.
 *
 * Run: npx tsx test-instrumentation-e2e-live.ts
 *
 * Optional:
 *   FRAMEWORKS    — comma-separated subset to run (default: all)
 *   SKIP_BUILD    — "1" skips the test-harness build step
 */

import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import type { Browser, Page } from 'puppeteer';

import {
  LIVE_SITES,
  log,
  warn,
  fail,
} from './shared/frameworks.js';

import {
  EXPECTED_EVENTS,
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

// Frameworks confirmed to have a page-level feedback widget on their test pages.
const FEEDBACK_REQUIRED = new Set(['mkdocs-material']);

// Frameworks whose test pages have no documentation-level expandable content.
const EXPAND_NONE = new Set(['nextra', 'docsy-dev']);

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

function buildPatchedHarness(framework: string): string {
  const src = fs.readFileSync(HARNESS_SRC, 'utf8');
  const configBlock = `\nwindow.__do11yTestSetConfig({ framework: '${framework}', debug: false, sectionVisibleThreshold: 1 });\nwindow.__do11yTestInit();\n`;
  return src + configBlock;
}

// ─── Live-site interaction sequence (instrumentation variant) ────────────────

async function runInstrumentedLiveInteractions(
  page: Page,
  framework: string,
  startUrl: string,
  secondUrl: string,
): Promise<any[]> {
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

  // 9. Read captured events before close
  log('  → reading captured events…');
  const events = await page.evaluate(() => window.__do11yTestGetEvents()).catch(() => []);

  // 10. Trigger page_exit
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  await sleep(2000);

  return events;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFromMemory(
  framework: string,
  logRecords: any[],
): { pass: number; fail: number; lines: string[] } {
  const byType: Record<string, number> = {};
  for (const record of logRecords) {
    const eventName = record.eventName ?? record._eventName as string | undefined;
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

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  ensureBuild();

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

  let grandPass = 0;
  let grandFail = 0;

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n${'─'.repeat(60)}`);
    log(`${name} → ${site.startUrl}`);
    console.log(`${'─'.repeat(60)}`);

    const patchedHarness = buildPatchedHarness(name);

    let logRecords: any[] = [];
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument(patchedHarness);

      logRecords = await runInstrumentedLiveInteractions(page, name, site.startUrl, site.secondUrl);
      log(`  Captured ${logRecords.length} events`);
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
    }

    // Validate
    console.log(`\n┌─ ${name}`);
    console.log(`│  ${site.startUrl}`);
    if (logRecords.length === 0) {
      console.log(`│  ❌ No events captured — instrumentation may not have loaded`);
      grandFail += Object.values(EXPECTED_EVENTS).filter(e => e.min > 0).length;
    } else {
      const v = validateFromMemory(name, logRecords);
      for (const line of v.lines) console.log(`│  ${line}`);
      grandPass += v.pass;
      grandFail += v.fail;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(grandFail > 0 ? 1 : 0);
})();
