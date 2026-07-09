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

import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import type { Browser, Page } from 'puppeteer';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const SKIP_INSTALL = process.env.SKIP_INSTALL === '1';
const FORCE_INSTALL = process.env.SKIP_INSTALL === '0';
const SKIP_BUILD = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');
const SITES_DIR = path.join(__dirname, 'sites');

// ─── Types ───────────────────────────────────────────────────────────────────

interface Framework {
  port: number;
  type: 'npm' | 'pip' | 'static' | 'hugo';
  dir: string;
  staticDir?: string;
  do11yDest: string;
  startCmd?: string;
  startArgs?: string[];
  readyPattern?: RegExp;
  buildCmd?: string;
  startPage: string;
  guidePage: string;
}

interface DevHandle {
  proc: ChildProcess;
  getOutput: () => string;
}

interface TestResult {
  skipped?: boolean;
  reason?: string;
  tested?: boolean;
  interactionError?: string;
}

interface SupabaseRow {
  payload: {
    eventName?: string;
    testFramework?: string;
    testRunId?: string;
    [key: string]: unknown;
  };
}

interface EventExpectation {
  min: number;
}

// ─── Framework definitions ──────────────────────────────────────────────────

const FRAMEWORKS: Record<string, Framework> = {
  mintlify: {
    port: 4005,
    type: 'npm',
    dir: path.join(SITES_DIR, 'mintlify'),
    do11yDest: path.join(SITES_DIR, 'mintlify', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['start'],
    readyPattern: /Ready in|localhost:4005|started/i,
    startPage: '/introduction',
    guidePage: '/guide',
  },
  docusaurus: {
    port: 4001,
    type: 'npm',
    dir: path.join(SITES_DIR, 'docusaurus'),
    do11yDest: path.join(SITES_DIR, 'docusaurus', 'static', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['start'],
    readyPattern: /Docusaurus.*started|localhost:4001/,
    startPage: '/',
    guidePage: '/guide',
  },
  nextra: {
    port: 4002,
    type: 'npm',
    dir: path.join(SITES_DIR, 'nextra'),
    do11yDest: path.join(SITES_DIR, 'nextra', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /Ready in|started server|localhost:4002/,
    startPage: '/',
    guidePage: '/guide',
  },
  vitepress: {
    port: 4003,
    type: 'npm',
    dir: path.join(SITES_DIR, 'vitepress'),
    do11yDest: path.join(SITES_DIR, 'vitepress', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /vitepress.*started|localhost:4003/i,
    startPage: '/',
    guidePage: '/guide',
  },
  'mkdocs-material': {
    port: 4004,
    type: 'pip',
    dir: path.join(SITES_DIR, 'mkdocs-material'),
    do11yDest: path.join(SITES_DIR, 'mkdocs-material', 'docs', 'do11y.js'),
    startCmd: 'mkdocs',
    startArgs: ['serve', '--dev-addr', '127.0.0.1:4004', '--no-livereload'],
    readyPattern: /Serving on|Start watching|localhost:4004/,
    startPage: '/',
    guidePage: '/guide/',
  },
  starlight: {
    port: 4006,
    type: 'npm',
    dir: path.join(SITES_DIR, 'starlight'),
    do11yDest: path.join(SITES_DIR, 'starlight', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /astro.*started|localhost:4006/i,
    startPage: '/',
    guidePage: '/guide/',
  },
  docsy: {
    port: 4007,
    type: 'hugo',
    dir: path.join(SITES_DIR, 'docsy'),
    do11yDest: path.join(SITES_DIR, 'docsy', 'static', 'do11y.js'),
    startCmd: 'hugo',
    startArgs: ['server', '-p', '4007', '--bind', '127.0.0.1', '--disableLiveReload', '-D'],
    readyPattern: /localhost:4007|Web Server|watching/i,
    startPage: '/docs/',
    guidePage: '/docs/guide/',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string): void { console.log(`\x1b[36m[runner]\x1b[0m ${msg}`); }
function warn(msg: string): void { console.log(`\x1b[33m[runner]\x1b[0m ${msg}`); }
function fail(msg: string): void { console.log(`\x1b[31m[runner]\x1b[0m ${msg}`); }

function patchDo11y(destPath: string, framework: string, testRunId: string): void {
  const src = fs.readFileSync(DO11Y_SRC, 'utf8');

  const configBlock = `window.Do11yConfig = {
  supabaseUrl: '${SUPABASE_URL.trim()}',
  supabaseKey: '${SUPABASE_KEY.trim()}',
  supabaseTable: '${SUPABASE_TABLE.trim()}',
  debug: true,
  allowedDomains: null,
  sectionVisibleThreshold: 1,
};\n`;

  // Intercept fetch to inject testRunId and testFramework into every event
  // payload sent to the Supabase REST API.
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

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, configBlock + interceptBlock + src);
}

function waitForServer(port: number, timeoutMs = 180000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check(): void {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server on port ${port} did not start within ${timeoutMs}ms`));
      }
      const req = http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        if (res.statusCode! < 500) resolve();
        else setTimeout(check, 500);
      });
      req.on('error', () => setTimeout(check, 500));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 500); });
    }
    check();
  });
}

function startStaticServer(dir: string, port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url!);
      if (!path.extname(filePath)) filePath += '.html';
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        const types: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
        };
        res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function installDeps(fw: Framework): void {
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

function getPythonUserBins(): string[] {
  const dirs = new Set<string>();
  for (const cmd of ['python3 -m site --user-base', 'python -m site --user-base']) {
    try {
      const base = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (base) dirs.add(path.join(base, 'bin'));
    } catch { /* ignore */ }
  }
  const pyLibDir = path.join(process.env.HOME ?? '', 'Library', 'Python');
  try {
    for (const ver of fs.readdirSync(pyLibDir)) {
      dirs.add(path.join(pyLibDir, ver, 'bin'));
    }
  } catch { /* ignore */ }
  return [...dirs];
}

function startDevServer(fw: Framework): DevHandle {
  const env: NodeJS.ProcessEnv = { ...process.env, BROWSER: 'none', NODE_ENV: 'development' };
  if (fw.type === 'pip') {
    const extraPath = getPythonUserBins().join(':');
    if (extraPath) env.PATH = extraPath + ':' + (env.PATH ?? '');
  } else if (fw.type === 'hugo') {
    const binDir = path.join(fw.dir, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      env.PATH = binDir + ':' + (env.PATH ?? '');
    }
  }
  const proc = spawn(fw.startCmd!, fw.startArgs!, {
    cwd: fw.dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  let output = '';
  proc.stdout!.on('data', (d: Buffer) => { output += d.toString(); });
  proc.stderr!.on('data', (d: Buffer) => { output += d.toString(); });
  proc.on('error', (err: Error) => { fail(`  Server process error: ${err.message}`); });
  return { proc, getOutput: () => output };
}

function killProc(proc: ChildProcess): void {
  try { process.kill(-proc.pid!, 'SIGTERM'); } catch { /* ignore */ }
  try { proc.kill('SIGTERM'); } catch { /* ignore */ }
}

// ─── Puppeteer interaction scenarios ────────────────────────────────────────

async function runInteractions(browser: Browser, baseUrl: string, fw: Framework): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(`${baseUrl}${fw.startPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  // 2. Click a TOC link
  log('  → toc_click');
  const TOC_SELECTORS = [
    '#table-of-contents',
    '[data-testid="table-of-contents"]',
    '.table-of-contents',            // Docusaurus
    '.VPDocAsideOutline',            // VitePress
    '.VPLocalNavOutlineDropdown',   // VitePress
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

  // 4. Click search
  log('  → search_opened');
  const SEARCH_SEL =
    '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
    '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
    'site-search button[data-open-modal], ' +
    'button[aria-label*="search" i], ' +
    '.td-search input, .td-search__input';
  try {
    await page.waitForSelector(SEARCH_SEL, { timeout: 3000 });
    await page.click(SEARCH_SEL);
  } catch { warn('  ⚠ No search element found, skipping'); }
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button
  log('  → code_copied');
  try {
    const copyBtnSel = [
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

    const copyClicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, copyBtnSel);
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

  // 7. Click feedback button
  log('  → feedback');
  try {
    const feedbackClicked = await page.evaluate(() => {
      const container = document.querySelector(
        '[class*="feedback"], [class*="helpful"], [data-feedback]'
      );
      if (container) {
        const btn = container.querySelector('button[data-value], button');
        if (btn) { (btn as HTMLElement).click(); return true; }
      }
      return false;
    });
    if (!feedbackClicked) warn('  ⚠ No feedback widget found, skipping');
  } catch { /* ignore */ }
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

  // 8b. Click a TOC link on the guide page (validates per-page outline tracking)
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

  // 9. Trigger page_exit
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  await sleep(2000);
}

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

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

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

// ─── Validation ─────────────────────────────────────────────────────────────

const EXPECTED_EVENTS: Record<string, EventExpectation> = {
  'browser.do11y.page_view': { min: 2 },
  'browser.do11y.scroll_depth': { min: 1 },
  'browser.do11y.search_opened': { min: 0 },
  'browser.do11y.code_copied': { min: 1 },
  'browser.do11y.link_click': { min: 1 },
  'browser.do11y.page_exit': { min: 1 },
  'browser.do11y.expand_collapse': { min: 1 },
  'browser.do11y.toc_click': { min: 1 },
  'browser.do11y.feedback': { min: 0 },
  'browser.do11y.section_visible': { min: 1 },
};

function validateEvents(
  framework: string,
  rows: SupabaseRow[]
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
        installDeps(fw);
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

    const fwRows = allRows.filter(row => row.payload?.testFramework === name);
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
