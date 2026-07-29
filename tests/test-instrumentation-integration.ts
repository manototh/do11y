/**
 * Do11y instrumentation integration test runner.
 *
 * Tests DocsInstrumentation end-to-end against local documentation sites
 * for each supported framework. Uses the test harness IIFE with a
 * Supabase-backed OTel exporter — events are sent to a Supabase table
 * and validated by querying the REST API after all interactions complete.
 *
 * Run: npx tsx test-instrumentation-integration.ts
 *
 * Required (.env in this directory):
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_KEY        — Publishable key (for client-side inserts via PostgREST)
 *   SUPABASE_SECRET_KEY — Secret key (for server-side reads via PostgREST)
 *   SUPABASE_TABLE      — Table name (default: do11y_events)
 *
 * Optional:
 *   FRAMEWORKS    — Comma-separated list of frameworks to test (default: all)
 *   SKIP_BUILD    — "1" skips the test-harness build step
 *   SKIP_INSTALL  — "1" skips dependency install step
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { execSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import type { Browser, Page } from 'puppeteer';

import {
  FRAMEWORKS,
  type DevHandle,
  type SupabaseRow,
  killProc,
  waitForServer,
  startStaticServer,
  startDevServer,
  getPythonUserBins,
  log,
  warn,
  fail,
} from './shared/frameworks.js';

import {
  EXPECTED_EVENTS,
  validateEvents,
  sleep,
  autoScroll,
  clickTocLink,
  clickSearch,
  clickCopyButton,
  expandDetails,
  clickFeedback,
} from './shared/interactions.js';

// ─── Env ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const HARNESS_SRC = path.resolve(__dirname, 'harness', 'do11y-test-harness.js');
const SKIP_BUILD = process.env.SKIP_BUILD === '1';
const SKIP_INSTALL = process.env.SKIP_INSTALL === '1';
const FORCE_INSTALL = process.env.SKIP_INSTALL === '0';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function installDepsLocal(fw: import('./shared/frameworks.js').Framework): void {
  if (fw.type === 'npm' || fw.type === 'hugo') {
    if (!SKIP_INSTALL && (FORCE_INSTALL || !fs.existsSync(path.join(fw.dir, 'node_modules')))) {
      log(`  Installing npm dependencies…`);
      execSync('npm install', { cwd: fw.dir, stdio: 'pipe' });
    }
  } else if (fw.type === 'pip') {
    const extraPath = getPythonUserBins().join(':');
    const checkEnv = { ...process.env, PATH: extraPath + ':' + (process.env.PATH ?? '') };
    try {
      execSync('mkdocs --version', { stdio: 'pipe', env: checkEnv });
    } catch {
      log(`  Installing pip dependencies…`);
      try {
        execSync('pip install --user -r requirements.txt', { cwd: fw.dir, stdio: 'pipe' });
      } catch {
        execSync('pip3 install --user -r requirements.txt', { cwd: fw.dir, stdio: 'pipe' });
      }
    }
  }
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

/**
 * Instrumentation-specific interaction sequence.
 * Drives a user journey through a doc site page using the pre-injected
 * test harness. Events are sent to Supabase via the harness exporter.
 */
async function runInstrumentedInteractions(
  page: Page,
  baseUrl: string,
  fw: import('./shared/frameworks.js').Framework,
): Promise<void> {
  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(`${baseUrl}${fw.startPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  // 2. Click a TOC link
  log('  → toc_click');
  const tocClicked = await clickTocLink(page, 'data-do11y-test-toc');
  if (!tocClicked) warn('  ⚠ No TOC element found, skipping');
  await sleep(500);

  // 3. Scroll to bottom
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search
  log('  → search_opened');
  const searchClicked = await clickSearch(page);
  if (!searchClicked) warn('  ⚠ No search element found, skipping');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button
  log('  → code_copied');
  const copyClicked = await clickCopyButton(page);
  if (!copyClicked) warn('  ⚠ No copy button found, skipping');
  await sleep(500);

  // 6. Expand a <details> element
  log('  → expand_collapse');
  const expanded = await expandDetails(page);
  if (!expanded) warn('  ⚠ No <details> element found, skipping');
  await sleep(500);

  // 7. Click feedback button
  log('  → feedback');
  const feedbackClicked = await clickFeedback(page);
  if (!feedbackClicked) warn('  ⚠ No feedback widget found, skipping');
  await sleep(500);

  // 8. Click internal link to guide page
  log('  → link_click (internal) + page_view (guide)');
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

  // 8b. Click a TOC link on the guide page
  log('  → toc_click (guide page)');
  const guideTocClicked = await clickTocLink(page, 'data-do11y-test-toc-guide');
  if (!guideTocClicked) warn('  ⚠ No TOC element found on guide page, skipping');
  await sleep(500);

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

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SECRET_KEY) {
    fail('Missing required env vars: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY');
    process.exit(1);
  }

  ensureBuild();

  const testRunId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  log(`Test run: ${testRunId}`);
  log(`Table:    ${SUPABASE_TABLE}`);

  let frameworkNames = Object.keys(FRAMEWORKS);
  if (process.env.FRAMEWORKS) {
    const requested = process.env.FRAMEWORKS.split(',').map(s => s.trim());
    frameworkNames = frameworkNames.filter(n => requested.includes(n));
  }

  log(`Frameworks: ${frameworkNames.join(', ')}\n`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer') as {
    launch: (opts: { headless: boolean; args?: string[] }) => Promise<Browser>;
  };
  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });

  const servers: http.Server[] = [];
  const processes: ChildProcess[] = [];

  for (const name of frameworkNames) {
    const fw = FRAMEWORKS[name]!;
    console.log(`\n${'─'.repeat(60)}`);
    log(`${name} (port ${fw.port})`);
    console.log(`${'─'.repeat(60)}`);

    // 0. Kill anything already on this port
    try { execSync(`lsof -ti :${fw.port} | xargs kill -9`, { stdio: 'pipe' }); } catch { /* ok */ }
    const fwDir = fw.dir ?? fw.staticDir;
    if (fwDir) {
      for (const cache of ['.next', '.vitepress/cache', '.vitepress/dist', '_book']) {
        const cacheDir = path.join(fwDir, cache);
        if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    }

    // 0b. Build step for static sites that require it
    if (fw.buildCmd && fw.dir) {
      try {
        if (!SKIP_INSTALL && (FORCE_INSTALL || !fs.existsSync(path.join(fw.dir, 'node_modules')))) {
          log('  Installing npm dependencies…');
          execSync('npm install', { cwd: fw.dir, stdio: 'pipe' });
        }
        log('  Building…');
        execSync(fw.buildCmd, { cwd: fw.dir, stdio: 'pipe' });
      } catch (err) {
        warn(`  Skipping ${name}: build failed (${(err as Error).message})`);
        continue;
      }
    }

    // 1. Build patched harness with framework config + Supabase creds
    const patchedHarness = buildPatchedHarness(name, testRunId);

    // 2. Start server
    let server: http.Server | undefined;
    let devHandle: DevHandle | undefined;
    if (fw.type === 'static') {
      server = await startStaticServer(fw.staticDir!, fw.port);
      servers.push(server);
      log('  Static server started');
    } else {
      try {
        installDepsLocal(fw);
      } catch (err) {
        warn(`  Skipping ${name}: dependency install failed (${(err as Error).message})`);
        continue;
      }
      log('  Starting dev server…');
      devHandle = startDevServer(fw);
      processes.push(devHandle.proc);
    }

    // 3. Wait for server
    try {
      await waitForServer(fw.port);
      log('  Server ready');
    } catch (err) {
      if (devHandle) {
        const out = devHandle.getOutput();
        if (out) fail(`  Server output:\n${out.slice(-500)}`);
      }
      warn(`  Skipping ${name}: ${(err as Error).message}`);
      continue;
    }

    // 4. Run interactions with harness injection
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument(patchedHarness);

      await runInstrumentedInteractions(page, `http://localhost:${fw.port}`, fw);
      log('  Interactions complete');
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
    }
  }

  // 5. Shut down servers
  log('\nStopping servers…');
  for (const s of servers) s.close();
  for (const p of processes) killProc(p);
  await browser.close();

  // 6. Wait for Supabase to ingest
  log('Waiting 5s for Supabase ingest…');
  await sleep(5000);

  // 7. Query and validate
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

  for (const name of frameworkNames) {
    console.log(`\n┌─ ${name}`);
    const fwRows = allRows.filter(row => row.payload?._testFramework === name);
    console.log(`│  ${fwRows.length} events ingested`);

    if (fwRows.length === 0) {
      console.log(`│  ❌ No events found — instrumentation may not have loaded`);
      grandFail += Object.keys(EXPECTED_EVENTS).length;
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
