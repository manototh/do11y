/**
 * Do11y integration test runner.
 *
 * Loads SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY, SUPABASE_TABLE from .env in this directory.
 * Run: npm test (or npx tsx test-integrations.ts from this directory)
 *
 * For each supported framework, this script:
 *   1. Builds dist/do11y.js from source if it is not already present
 *   2. Scaffolds a minimal documentation site with do11y.js injected
 *   3. Starts the framework's dev server
 *   4. Drives Puppeteer through a set of user interactions
 *   5. Waits for events to flush to Supabase
 *   6. Queries the Supabase REST API to validate that the expected events arrived
 *
 * Required (set in .env in this directory):
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_KEY        — Publishable key (for client-side inserts via PostgREST)
 *   SUPABASE_SECRET_KEY — Secret key (for server-side reads via PostgREST)
 *   SUPABASE_TABLE      — Table name
 *
 * Optional (can override in .env or shell):
 *   FRAMEWORKS      — Comma-separated list of frameworks to test (default: all)
 *   SKIP_INSTALL    — "1" skips install entirely; "0" forces install even if node_modules exists; unset installs only when node_modules is absent
 *   SKIP_BUILD      — "1" skips the dist/do11y.js build step (use when you have already built)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { execSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import type { Browser } from 'puppeteer';

import {
  FRAMEWORKS,
  type DevHandle,
  type TestResult,
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
  runInteractions,
  validateEvents,
  EXPECTED_EVENTS,
  sleep,
} from './shared/interactions.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const SKIP_INSTALL = process.env.SKIP_INSTALL === '1';
const FORCE_INSTALL = process.env.SKIP_INSTALL === '0';
const SKIP_BUILD = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function patchDo11y(destPath: string, framework: string, testRunId: string): void {
  const src = fs.readFileSync(DO11Y_SRC, 'utf8');

  const configBlock = `window.Do11yConfig = {
  supabaseUrl: '${SUPABASE_URL.trim()}',
  supabaseKey: '${SUPABASE_KEY.trim()}',
  supabaseTable: '${SUPABASE_TABLE.trim()}',
  framework: '${framework}',
  debug: true,
  allowedDomains: null,
  sectionVisibleThreshold: 1,
  testRunId: '${testRunId}',
  testFramework: '${framework}',
};\n`;

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, configBlock + src);
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

// ─── Build ───────────────────────────────────────────────────────────────────

function ensureBuild(): void {
  if (SKIP_BUILD) {
    log('SKIP_BUILD=1 — skipping build step');
    if (!fs.existsSync(DO11Y_SRC)) {
      fail(`dist/do11y.js not found and SKIP_BUILD=1. Run \`npm run build\` in the repo root first.`);
      process.exit(1);
    }
    return;
  }
  log('Building dist/do11y.js from source…');
  execSync('npm run build', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
  log('Build complete\n');
}

// ─── Supabase query ─────────────────────────────────────────────────────────

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

  const testRunId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  log(`Test run: ${testRunId}`);
  log(`Table:    ${SUPABASE_TABLE}`);

  let frameworkNames = Object.keys(FRAMEWORKS);
  if (process.env.FRAMEWORKS) {
    const requested = process.env.FRAMEWORKS.split(',').map(s => s.trim());
    frameworkNames = frameworkNames.filter(n => requested.includes(n));
  }

  log(`Frameworks: ${frameworkNames.join(', ')}\n`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer') as { launch: (opts: { headless: boolean; args?: string[] }) => Promise<Browser> };
  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });

  const servers: http.Server[] = [];
  const processes: ChildProcess[] = [];
  const results: Record<string, TestResult> = {};

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
        results[name] = { skipped: true, reason: (err as Error).message };
        continue;
      }
    }

    // 1. Patch and deploy do11y.js
    log('  Patching do11y.js…');
    patchDo11y(fw.do11yDest, name, testRunId);

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
        results[name] = { skipped: true, reason: (err as Error).message };
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
      results[name] = { skipped: true, reason: (err as Error).message };
      continue;
    }

    // 4. Run interactions
    try {
      await runInteractions(browser, `http://localhost:${fw.port}`, fw);
      log('  Interactions complete');
      results[name] = { tested: true };
    } catch (err) {
      warn(`  Interaction error: ${(err as Error).message}`);
      results[name] = { tested: true, interactionError: (err as Error).message };
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

  // 8. Validate per framework
  let grandPass = 0;
  let grandFail = 0;

  for (const name of frameworkNames) {
    const r = results[name];
    console.log(`\n┌─ ${name}`);

    if (r?.skipped) {
      console.log(`│  ⏭  Skipped: ${r.reason}`);
      continue;
    }

    const fwRows = allRows.filter(row => row.payload?._testFramework === name);
    console.log(`│  ${fwRows.length} events ingested`);

    if (fwRows.length === 0) {
      console.log(`│  ❌ No events found — do11y may not have loaded or flushed`);
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

  // Clean up patched do11y copies
  for (const name of frameworkNames) {
    const fw = FRAMEWORKS[name]!;
    try { fs.unlinkSync(fw.do11yDest); } catch { /* ignore */ }
  }

  process.exit(grandFail > 0 ? 1 : 0);
})();
