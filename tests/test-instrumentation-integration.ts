/**
 * Do11y instrumentation integration test runner.
 *
 * Tests DocsInstrumentation end-to-end against local documentation sites
 * for each supported framework. Uses the test harness IIFE to capture
 * events in-memory via an OTel InMemoryLogRecordExporter — no Supabase
 * credentials needed for pass/fail validation.
 *
 * Run: npx tsx test-instrumentation-integration.ts
 *
 * Optional:
 *   FRAMEWORKS    — Comma-separated list of frameworks to test (default: all)
 *   SKIP_BUILD    — "1" skips the test-harness build step
 *   SKIP_INSTALL  — "1" skips dependency install step
 */

import path from 'path';
import { execSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import type { Browser, Page } from 'puppeteer';

import {
  FRAMEWORKS,
  type DevHandle,
  type TestResult,
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
  sleep,
  autoScroll,
  clickTocLink,
  clickSearch,
  clickCopyButton,
  expandDetails,
  clickFeedback,
} from './shared/interactions.js';

// Test harness config — no Supabase needed
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

function buildPatchedHarness(framework: string): string {
  const src = fs.readFileSync(HARNESS_SRC, 'utf8');
  const configBlock = `\nwindow.__do11yTestSetConfig({ framework: '${framework}', debug: false, sectionVisibleThreshold: 1 });\nwindow.__do11yTestInit();\n`;
  return src + configBlock;
}

/**
 * Instrumentation-specific interaction sequence.
 * Drives a user journey through a doc site page using the pre-injected
 * test harness. Returns captured LogRecords on completion.
 */
async function runInstrumentedInteractions(
  page: Page,
  baseUrl: string,
  fw: import('./shared/frameworks.js').Framework,
): Promise<any[]> {
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

  // 9. Read captured events before close
  log('  → reading captured events…');
  const events = await page.evaluate(() => window.__do11yTestGetEvents()).catch(() => []);

  // 10. Trigger page_exit
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  await sleep(2000);

  return events;
}

// ─── Validation (in-memory) ──────────────────────────────────────────────────

interface ValidationResult {
  pass: number;
  fail: number;
  lines: string[];
  total: number;
}

function validateFromMemory(
  framework: string,
  logRecords: any[],
): ValidationResult {
  const byType: Record<string, number> = {};
  for (const record of logRecords) {
    const eventName = record.eventName ?? record._eventName as string | undefined;
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

  return { pass, fail: failCount, lines, total: logRecords.length };
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  ensureBuild();

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
  let grandPass = 0;
  let grandFail = 0;

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

    // 1. Build patched harness with framework config
    const patchedHarness = buildPatchedHarness(name);

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
    let logRecords: any[] = [];
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument(patchedHarness);

      logRecords = await runInstrumentedInteractions(page, `http://localhost:${fw.port}`, fw);
      log(`  Captured ${logRecords.length} events`);
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
    }

    // 5. Validate
    console.log(`\n┌─ ${name}`);
    if (logRecords.length === 0) {
      console.log(`│  ❌ No events captured — instrumentation may not have loaded`);
      grandFail += Object.keys(EXPECTED_EVENTS).length;
    } else {
      const v = validateFromMemory(name, logRecords);
      for (const line of v.lines) console.log(`│  ${line}`);
      grandPass += v.pass;
      grandFail += v.fail;
    }
  }

  // 6. Shut down servers
  log('\nStopping servers…');
  for (const s of servers) s.close();
  for (const p of processes) killProc(p);
  await browser.close();

  // 7. Report
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${grandPass} passed, ${grandFail} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(grandFail > 0 ? 1 : 0);
})();
