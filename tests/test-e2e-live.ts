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
import type { Browser } from 'puppeteer';

import {
  LIVE_SITES,
  type SupabaseRow,
  log,
  warn,
  fail,
} from './shared/frameworks.js';

import {
  EXPECTED_EVENTS,
  runInteractionsLive,
  validateEventsLive,
  sleep,
} from './shared/interactions.js';

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const SKIP_BUILD     = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');

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
  testRunId: '${testRunId}',
  testFramework: '${framework}',
};\n`;

  return configBlock + src;
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

  const results: Record<string, { tested: boolean; error?: string }> = {};

  for (const name of siteNames) {
    const site = LIVE_SITES[name]!;
    console.log(`\n${'─'.repeat(60)}`);
    log(`${name} → ${site.startUrl}`);
    console.log(`${'─'.repeat(60)}`);

    const patchedScript = buildPatchedScript(name, testRunId);

    try {
      await runInteractionsLive(browser, name, site, patchedScript);
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

    const fwRows = allRows.filter(row => row.payload?._testFramework === name);
    console.log(`│  ${fwRows.length} events ingested`);

    if (fwRows.length === 0) {
      console.log(`│  ❌ No events found — do11y may not have loaded or ingest was blocked`);
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
