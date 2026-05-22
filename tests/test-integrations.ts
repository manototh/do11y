/**
 * Do11y integration test runner.
 *
 * Loads AXIOM_DOMAIN, AXIOM_TOKEN, AXIOM_DATASET from .env in this directory.
 * Run: npm test (or npx tsx test-integrations.ts from this directory)
 *
 * For each supported framework, this script:
 *   1. Builds dist/do11y.js from source if it is not already present
 *   2. Scaffolds a minimal documentation site with do11y.js injected
 *   3. Starts the framework's dev server
 *   4. Drives Puppeteer through a set of user interactions
 *   5. Waits for events to flush to Axiom
 *   6. Queries the Axiom API to validate that the expected events arrived
 *
 * Required (set in .env in this directory):
 *   AXIOM_DOMAIN      — Axiom domain
 *   AXIOM_TOKEN       — API token with ingest + query permissions
 *   AXIOM_DATASET     — Dataset name
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

const AXIOM_DOMAIN = process.env.AXIOM_DOMAIN!;
const AXIOM_TOKEN = process.env.AXIOM_TOKEN!;
const AXIOM_DATASET = process.env.AXIOM_DATASET!;
const SKIP_INSTALL = process.env.SKIP_INSTALL === '1';
const FORCE_INSTALL = process.env.SKIP_INSTALL === '0';
const SKIP_BUILD = process.env.SKIP_BUILD === '1';

const DO11Y_SRC = path.resolve(__dirname, '../dist/do11y.js');
const SITES_DIR = path.join(__dirname, 'sites');

// ─── Types ───────────────────────────────────────────────────────────────────

interface Framework {
  port: number;
  type: 'npm' | 'pip' | 'static';
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

interface AxiomEvent {
  eventType?: string;
  testFramework?: string;
  [key: string]: unknown;
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
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string): void { console.log(`\x1b[36m[runner]\x1b[0m ${msg}`); }
function warn(msg: string): void { console.log(`\x1b[33m[runner]\x1b[0m ${msg}`); }
function fail(msg: string): void { console.log(`\x1b[31m[runner]\x1b[0m ${msg}`); }

function patchDo11y(destPath: string, framework: string, testRunId: string): void {
  const src = fs.readFileSync(DO11Y_SRC, 'utf8');

  // Prepend a window.Do11yConfig block so credentials never need to be
  // string-replaced inside the built artifact (resilient to minification).
  const configBlock = `window.Do11yConfig = {
  axiomHost: '${AXIOM_DOMAIN.trim()}',
  axiomDataset: '${AXIOM_DATASET.trim()}',
  axiomToken: '${AXIOM_TOKEN.trim()}',
  debug: true,
  allowedDomains: null,
  // Lower section-visibility threshold so headings visible for ≥1s are recorded.
  // The test sleeps 2s after page load, which comfortably exceeds this.
  sectionVisibleThreshold: 1,
};\n`;

  // Intercept fetch to inject testRunId and testFramework into every ingest
  // request. This avoids patching compiled source and works regardless of how
  // rolldown names or formats the event-object literal.
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
  if (fw.type === 'npm') {
    if (!SKIP_INSTALL && (FORCE_INSTALL || !fs.existsSync(path.join(fw.dir, 'node_modules')))) {
      log(`  Installing npm dependencies…`);
      execSync('npm install', { cwd: fw.dir, stdio: 'pipe' });
    }
  } else if (fw.type === 'pip') {
    // Always check for the binary; pip packages aren't in node_modules
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
  // pip and python3 may resolve to different Python versions (e.g. Xcode 3.9
  // vs Homebrew 3.12), so collect all known user-site bin directories.
  const dirs = new Set<string>();
  for (const cmd of ['python3 -m site --user-base', 'python -m site --user-base']) {
    try {
      const base = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (base) dirs.add(path.join(base, 'bin'));
    } catch { /* ignore */ }
  }
  // Also scan ~/Library/Python/*/bin on macOS
  const pyLibDir = path.join(process.env.HOME ?? '', 'Library', 'Python');
  try {
    for (const ver of fs.readdirSync(pyLibDir)) {
      dirs.add(path.join(pyLibDir, ver, 'bin'));
    }
  } catch { /* ignore */ }
  return [...dirs];
}

function startDevServer(fw: Framework): DevHandle {
  const env = { ...process.env, BROWSER: 'none', NODE_ENV: 'development' };
  if (fw.type === 'pip') {
    const extraPath = getPythonUserBins().join(':');
    if (extraPath) env.PATH = extraPath + ':' + (env.PATH ?? '');
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
  // 1440px wide ensures VitePress (≥1280px) and other frameworks render the
  // aside TOC panel; also benefits any framework with a responsive layout.
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Page view on start page
  log('  → page_view (start page)');
  await page.goto(`${baseUrl}${fw.startPage}`, { waitUntil: 'networkidle2', timeout: 30000 });
  // Sleep 2s so headings in the initial viewport accumulate ≥1s of visibility
  // (matches the sectionVisibleThreshold: 1 set in the test Do11yConfig).
  await sleep(2000);

  // 2. Click a TOC link *before* scrolling so the page is at the top, the TOC
  //    panel is freshly rendered, and the anchor links are reachable.
  log('  → toc_click');
  // Find the TOC link via evaluate, mark it, then click via Puppeteer's native
  // page.click() — the same approach that fixed search_opened. Synthetic
  // el.click() from evaluate is less reliable for triggering do11y's
  // capture-phase document listener.
  const TOC_SELECTORS = [
    '#table-of-contents',            // Mintlify (id-based, not class-based)
    '[data-testid="table-of-contents"]',
    '.table-of-contents',            // Docusaurus
    '.VPDocAsideOutline',            // VitePress
    '.md-sidebar--secondary .md-nav', // MkDocs Material
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
      warn('  ⚠ No TOC element found, skipping');
    }
  } catch { /* ignore */ }
  await sleep(500);

  // 3. Scroll to bottom (triggers scroll_depth; also sends headings through
  //    the IntersectionObserver exit callback → section_visible events)
  log('  → scroll_depth');
  await autoScroll(page);
  await sleep(1000);

  // 4. Click search (triggers search_opened).
  //    Uses Puppeteer's native page.click() which dispatches real pointer events,
  //    more reliably triggering do11y's capture-phase listener than el.click().
  log('  → search_opened');
  const SEARCH_SEL =
    '#search-bar-entry, .DocSearch-Button, .nextra-search input, ' +
    '[data-testid*="search"], .md-search__input, .VPNavBarSearchButton, ' +
    'button[aria-label*="search" i]';
  try {
    await page.waitForSelector(SEARCH_SEL, { timeout: 3000 });
    await page.click(SEARCH_SEL);
  } catch { warn('  ⚠ No search element found, skipping'); }
  await sleep(500);
  // Close any open dialog/overlay
  await page.keyboard.press('Escape');
  await sleep(300);

  // 5. Click copy button (triggers code_copied)
  log('  → code_copied');
  try {
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
    if (!copyClicked) warn('  ⚠ No copy button found, skipping');
  } catch { /* ignore */ }
  await sleep(500);

  // 6. Expand a <details> element (triggers expand_collapse)
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

  // 7. Click feedback button (triggers feedback)
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

  // 8. Click internal link to guide page (triggers link_click + page_view)
  log('  → link_click (internal) + page_view (guide)');
  try {
    // Find the link and click it via Puppeteer's mouse (fires DOM click event
    // before SPA routers can intercept, ensuring do11y captures it)
    // Build selector covering absolute and relative path variants
    const gp = fw.guidePage;
    const relPath = gp.startsWith('/') ? gp.slice(1) : gp;
    const linkSel = [gp, `${gp}.html`, `${gp}/`, relPath, `${relPath}.html`, `${relPath}/`, `${relPath}.md`]
      .map((h) => `a[href="${h}"]`).join(', ');
    // Use a generous timeout: Next.js dev server compiles routes on demand,
    // so in CI the guide page route may not be ready within 5 s.
    await page.waitForSelector(linkSel, { timeout: 10000 });
    // Scroll the link into view first (needed for VitePress/Docusaurus where
    // the link may be below the fold)
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

  // 9. Trigger page_exit.
  // page.goto('about:blank') does not reliably fire beforeunload in headless
  // Chrome on Linux (CI). page.close({ runBeforeUnload: true }) is the
  // Puppeteer-idiomatic way to guarantee the beforeunload event fires, which
  // triggers emitPageExit() → flushVisibleSections() → cleanup() → flushSync().
  log('  → page_exit');
  await page.close({ runBeforeUnload: true });
  // Allow the keepalive fetch dispatched by flushSync() to finish before the
  // test runner proceeds to shut down servers and query Axiom.
  await sleep(2000);
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const distance = 200;
      const delay = 80;

      // Some frameworks use container-based scrolling.
      // Find the scrollable container so we scroll it instead of the window.
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

      // Inline scroll-position helpers — named arrow function assignments
      // trigger esbuild's __name helper which is not available in the
      // browser context when Puppeteer serialises this callback as a string.
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

// ─── Axiom query ────────────────────────────────────────────────────────────

async function queryAxiom(testRunId: string, startTime: Date): Promise<AxiomEvent[]> {
  const apl = `['${AXIOM_DATASET}'] | where testRunId == '${testRunId}' | order by _time asc`;
  const body = JSON.stringify({
    apl,
    startTime: startTime.toISOString(),
    endTime: new Date().toISOString(),
  });

  const url = `https://${AXIOM_DOMAIN}/v1/query/_apl?format=tabular`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AXIOM_TOKEN}`,
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
    tables?: Array<{
      fields?: Array<{ name: string }>;
      columns?: unknown[][];
    }>;
    matches?: Array<{ _source?: AxiomEvent; data?: AxiomEvent }>;
  };
  try { data = JSON.parse(text); } catch { throw new Error(`Axiom returned non-JSON: ${text.slice(0, 500)}`); }

  // Axiom tabular format: fields[] has column names, columns[] is column-oriented data
  const table = data.tables?.[0];
  if (table?.fields && table?.columns) {
    const fieldNames = table.fields.map(f => f.name);
    const numRows = table.columns[0]?.length ?? 0;
    const rows: AxiomEvent[] = [];
    for (let j = 0; j < numRows; j++) {
      const obj: AxiomEvent = {};
      fieldNames.forEach((name, i) => { obj[name] = table.columns![i]?.[j]; });
      rows.push(obj);
    }
    return rows;
  }

  // Legacy format: data.matches[]
  if (Array.isArray(data.matches)) {
    return data.matches.map(m => m._source ?? m.data ?? m as AxiomEvent);
  }

  return [];
}

// ─── Validation ─────────────────────────────────────────────────────────────

const EXPECTED_EVENTS: Record<string, EventExpectation> = {
  page_view: { min: 2 },
  scroll_depth: { min: 1 },
  search_opened: { min: 0 },        // best-effort — not all frameworks have a search element
  code_copied: { min: 1 },
  link_click: { min: 1 },
  page_exit: { min: 1 },
  expand_collapse: { min: 1 },
  toc_click: { min: 1 },
  feedback: { min: 0 },             // best-effort — requires a feedback widget in DOM
  section_visible: { min: 1 },      // sectionVisibleThreshold: 1 + 2s sleep guarantees this
};

function validateEvents(
  framework: string,
  events: AxiomEvent[]
): { pass: number; fail: number; lines: string[]; total: number } {
  const byType: Record<string, number> = {};
  for (const e of events) {
    if (e.eventType) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
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

  return { pass, fail: failCount, lines, total: events.length };
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  // Validate env
  if (!AXIOM_DOMAIN || !AXIOM_TOKEN || !AXIOM_DATASET) {
    fail('Missing required env vars: AXIOM_DOMAIN, AXIOM_TOKEN, AXIOM_DATASET');
    process.exit(1);
  }

  // Build dist/do11y.js from TypeScript source before anything else
  ensureBuild();

  const testRunId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date();
  log(`Test run: ${testRunId}`);
  log(`Dataset:  ${AXIOM_DATASET}`);

  // Filter frameworks if FRAMEWORKS env is set
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
    // Clean stale build caches that cause 500 errors on cold start
    const fwDir = fw.dir ?? fw.staticDir;
    if (fwDir) {
      for (const cache of ['.next', '.vitepress/cache', '.vitepress/dist', '_book']) {
        const cacheDir = path.join(fwDir, cache);
        if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    }

    // 0b. Build step for static sites that require it (e.g. HonKit)
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

  // 6. Wait for Axiom to ingest
  log('Waiting 15s for Axiom ingest…');
  await sleep(15000);

  // 7. Query and validate
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

    const fwEvents = allEvents.filter(e => e.testFramework === name);
    console.log(`│  ${fwEvents.length} events ingested`);

    if (fwEvents.length === 0) {
      console.log(`│  ❌ No events found — do11y may not have loaded or flushed`);
      grandFail += Object.keys(EXPECTED_EVENTS).length;
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

  // Clean up patched do11y copies
  for (const name of frameworkNames) {
    const fw = FRAMEWORKS[name]!;
    try { fs.unlinkSync(fw.do11yDest); } catch { /* ignore */ }
  }

  process.exit(grandFail > 0 ? 1 : 0);
})();
