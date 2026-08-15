/**
 * Integration test — Instrumentation file, all 7 frameworks, OTel export.
 *
 * Builds dist/instrumentation/index.js, creates HTML pages that load
 * the OTel SDK with DocsInstrumentation, drives Puppeteer interactions,
 * validates events captured via a custom OTel LoggerProvider that
 * stores log records in sessionStorage (surviving page navigations).
 *
 * No credentials required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createStaticServer } from '../helpers/static-server';
import {
  autoScroll,
  sleep,
  TOC_SELECTORS,
  SEARCH_SELECTORS,
  COPY_BUTTON_SELECTORS,
  log,
  warn,
} from '../helpers/puppeteer-interactions';
import type { Browser, Page } from 'puppeteer';
import type { StaticServer } from '../helpers/static-server';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const INSTRUMENTATION_PATH = path.resolve(
  __dirname,
  '../../dist/instrumentation/index.js',
);

// ─── Framework constants ────────────────────────────────────────────────────

const FRAMEWORKS = [
  'mintlify',
  'docusaurus',
  'nextra',
  'mkdocs-material',
  'vitepress',
  'starlight',
  'docsy',
] as const;

const EXPECTED_EVENT_TYPES = [
  'browser.do11y.page_view',
  'browser.do11y.toc_click',
  'browser.do11y.scroll_depth',
  'browser.do11y.search_opened',
  'browser.do11y.code_copied',
  'browser.do11y.expand_collapse',
  'browser.do11y.feedback',
  'browser.do11y.link_click',
  'browser.do11y.page_exit',
] as const;

/** Frameworks whose default UI does not include a feedback widget. */
const FEEDBACK_NONE = new Set(['docusaurus', 'nextra', 'vitepress', 'starlight']);

// ─── HTML generation ────────────────────────────────────────────────────────

/**
 * Generate a test HTML page that loads DocsInstrumentation with a custom
 * OTel LoggerProvider that captures log records into sessionStorage.
 *
 * The importmap redirects @opentelemetry/instrumentation to its browser-safe
 * ESM build (the default entry imports Node.js modules). The module script
 * sets a global LoggerProvider before creating DocsInstrumentation, so all
 * emitted log records are stored in sessionStorage under 'do11y_test_records'.
 */
function generateInstrumentationHtml(
  framework: string,
  rootUrl: string,
  fixtureBody: string,
): string {
  const importmap = {
    imports: {
      '@opentelemetry/api': `${rootUrl}/node_modules/@opentelemetry/api/build/esm/index.js`,
      '@opentelemetry/api-logs': `${rootUrl}/node_modules/@opentelemetry/api-logs/build/esm/index.js`,
      '@opentelemetry/instrumentation': `${rootUrl}/node_modules/@opentelemetry/instrumentation/build/esm/platform/browser/index.js`,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Do11y Instrumentation Test - ${framework}</title>
<script type="importmap">${JSON.stringify(importmap, null, 2)}</script>
</head>
<body>
${fixtureBody}
<script type="module">
// Custom LoggerProvider: capture all emitted log records into sessionStorage
// so they survive page navigations (same-origin).
const STORAGE_KEY = 'do11y_test_records';
const { logs } = await import('@opentelemetry/api-logs');
logs.setGlobalLoggerProvider({
  getLogger: () => ({
    emit: (record) => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
        stored.push(record);
        // Keep at most 200 records to avoid storage limits
        if (stored.length > 200) stored.splice(0, stored.length - 200);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch { /* best-effort */ }
    },
  }),
});

// Load and enable DocsInstrumentation
const { DocsInstrumentation } = await import('${rootUrl}/dist/instrumentation/index.js');
const inst = new DocsInstrumentation({ framework: '${framework}', debug: false });
inst.enable();
window.__do11yTestInstrumentation = inst;
</script>
</body>
</html>`;
}

/**
 * Generate both start and guide .otel.html files for a framework.
 * Navigation links in the start page are rewritten to point to the
 * guide .otel.html so the instrumentation context survives navigation.
 */
function generateOtelFixtureFiles(
  framework: string,
  rootUrl: string,
  fixtureDir: string,
): void {
  const startPath = path.join(fixtureDir, `${framework}-start.html`);
  const guidePath = path.join(fixtureDir, `${framework}-guide.html`);

  const startBody = fs.readFileSync(startPath, 'utf-8');
  const guideBody = fs.readFileSync(guidePath, 'utf-8');

  // Rewrite navigation links in the start page to point to the .otel.html
  // version of the guide page, so clicking the link navigates to a page
  // that also has the instrumentation setup.
  const guideFile = `${framework}-guide.html`;
  const guideOtelFile = `${framework}-guide.otel.html`;
  const modifiedStartBody = startBody.replace(
    new RegExp(`(href="[^"]*)${escapeRegex(guideFile)}(")`, 'g'),
    `$1${guideOtelFile}$2`,
  );

  const startOtel = generateInstrumentationHtml(framework, rootUrl, modifiedStartBody);
  const guideOtel = generateInstrumentationHtml(framework, rootUrl, guideBody);

  fs.writeFileSync(path.join(fixtureDir, `${framework}-start.otel.html`), startOtel);
  fs.writeFileSync(path.join(fixtureDir, `${framework}-guide.otel.html`), guideOtel);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── SPA test fixture generation ─────────────────────────────────────────────

/**
 * Generate the SPA test fixture HTML page.
 *
 * This page loads DocsInstrumentation with trackSpaPathChanges: true,
 * then after a brief delay simulates an SPA navigation via pushState
 * + DOM content swap. The test validates that page_exit + new page_view
 * are emitted with the correct paths.
 */
function generateSpaTestFixture(rootUrl: string, fixtureDir: string): void {
  const framework = 'mintlify';
  const startBody = fs.readFileSync(
    path.join(fixtureDir, `${framework}-start.html`),
    'utf-8',
  );

  const importmap = {
    imports: {
      '@opentelemetry/api': `${rootUrl}/node_modules/@opentelemetry/api/build/esm/index.js`,
      '@opentelemetry/api-logs': `${rootUrl}/node_modules/@opentelemetry/api-logs/build/esm/index.js`,
      '@opentelemetry/instrumentation': `${rootUrl}/node_modules/@opentelemetry/instrumentation/build/esm/platform/browser/index.js`,
    },
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Do11y SPA Test</title>
<script type="importmap">${JSON.stringify(importmap, null, 2)}</script>
</head>
<body>
${startBody}
<script type="module">
const STORAGE_KEY = 'do11y_test_records';
const { logs } = await import('@opentelemetry/api-logs');
logs.setGlobalLoggerProvider({
  getLogger: () => ({
    emit: (record) => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
        stored.push(record);
        if (stored.length > 200) stored.splice(0, stored.length - 200);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch { /* best-effort */ }
    },
  }),
});

const { DocsInstrumentation } = await import('${rootUrl}/dist/instrumentation/index.js');
const inst = new DocsInstrumentation({
  framework: '${framework}',
  debug: false,
  trackSpaPathChanges: true,
});
inst.enable();
window.__do11yTestInstrumentation = inst;

// Wait a moment for initial page_view, then simulate SPA navigation
await new Promise(r => setTimeout(r, 500));
history.pushState({}, '', '/spa-new-page');
document.title = 'SPA New Page';
document.body.innerHTML = '<main><h1>SPA New Content</h1></main>';
window.__do11ySpaNavigated = true;
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(fixtureDir, 'spa-test.otel.html'), html);
}

/**
 * Generate the ordering regression fixture.
 *
 * Reproduces the documented-but-broken pattern: the instrumentation is
 * constructed (and self-enables, emitting the initial page_view) BEFORE the
 * global LoggerProvider is registered. The emit path must lazily resolve the
 * logger per event so records emitted AFTER the provider is registered still
 * flow through it (api-logs version negotiation). Without the lazy-logger
 * fix, every record is silently dropped by the NOOP logger.
 */
function generateOrderingTestFixture(rootUrl: string, fixtureDir: string): void {
  const framework = 'mintlify';
  const startBody = fs.readFileSync(
    path.join(fixtureDir, `${framework}-start.html`),
    'utf-8',
  );

  const importmap = {
    imports: {
      '@opentelemetry/api': `${rootUrl}/node_modules/@opentelemetry/api/build/esm/index.js`,
      '@opentelemetry/api-logs': `${rootUrl}/node_modules/@opentelemetry/api-logs/build/esm/index.js`,
      '@opentelemetry/instrumentation': `${rootUrl}/node_modules/@opentelemetry/instrumentation/build/esm/platform/browser/index.js`,
    },
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Do11y Ordering Test</title>
<script type="importmap">${JSON.stringify(importmap, null, 2)}</script>
</head>
<body>
${startBody}
<script type="module">
const STORAGE_KEY = 'do11y_test_records';
const { DocsInstrumentation } = await import('${rootUrl}/dist/instrumentation/index.js');
const inst = new DocsInstrumentation({ framework: '${framework}', debug: false });
inst.enable();
window.__do11yTestInstrumentation = inst;
// The initial page_view emitted during enable() is intentionally dropped:
// no LoggerProvider is registered yet.

// Register the LoggerProvider AFTER the instrumentation was constructed —
// this is the regression scenario that used to silently lose all events.
const { logs } = await import('@opentelemetry/api-logs');
logs.setGlobalLoggerProvider({
  getLogger: () => ({
    emit: (record) => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
        stored.push(record);
        if (stored.length > 200) stored.splice(0, stored.length - 200);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch { /* best-effort */ }
    },
  }),
});
window.__do11yOrderingReady = true;
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(fixtureDir, 'ordering-test.otel.html'), html);
}

// ─── Interaction sequence ───────────────────────────────────────────────────

/**
 * Run the standard interaction sequence (steps 1–9, no page close).
 *
 * This mirrors runInteractions() from puppeteer-interactions.ts but
 * omits the page close / flush step (step 10) so the test can
 * trigger page_exit manually and read records from sessionStorage
 * before closing the page.
 */
async function instrumentationInteractionSequence(
  page: Page,
  config: { guidePath: string; pageLoadTimeout?: number },
): Promise<void> {
  const timeout = config.pageLoadTimeout ?? 30000;

  // 1. Initial wait for JS-rendered content
  await sleep(2000);

  // 2. Click a TOC link
  log('  → toc_click');
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

  // 4. Click search element
  log('  → search_opened');
  try {
    const clicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, SEARCH_SELECTORS);
    if (!clicked) warn('  ⚠ No search element found, skipping');
  } catch { warn('  ⚠ Search interaction failed, skipping'); }
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

    const copyClicked = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) { (el as HTMLElement).click(); return true; }
      return false;
    }, COPY_BUTTON_SELECTORS);
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

    const feedbackClicked = await page.evaluate(() => {
      const candidates = document.querySelectorAll(
        '[class*="feedback"], [class*="helpful"], [data-feedback], ' +
        '#feedback-thumbs-up, #feedback-thumbs-down'
      );
      for (const el of candidates) {
        if (el.tagName === 'BUTTON') {
          (el as HTMLElement).click(); return true;
        }
        const btn = el.querySelector('button');
        if (btn) { (btn as HTMLElement).click(); return true; }
      }
      return false;
    });
    if (!feedbackClicked) warn('  ⚠ No feedback widget found, skipping');
  } catch { /* ignore */ }
  await sleep(500);

  // 8. Navigate to guide page (link_click + second page_view)
  log('  → link_click (internal) + page_view (guide)');
  try {
    const gp = config.guidePath;
    const relHref = gp.split('/').pop() || gp;
    const relPath = gp.startsWith('/') ? gp.slice(1) : gp;
    const linkSel = [
      gp,
      `./${relHref}`,
      relHref,
      `${gp}.html`,
      `${gp}/`,
      relPath,
      `${relPath}.html`,
      `${relPath}/`,
      `${relPath}.md`,
    ]
      .map((h) => `a[href="${h}"]`)
      .join(', ');

    try {
      await page.waitForSelector(linkSel, { timeout: 5000 });
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ block: 'center' });
      }, linkSel);
      await sleep(300);
      await Promise.all([
        page.click(linkSel),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout }).catch(() => {}),
      ]);
    } catch {
      const found = await page.evaluate((targetPath: string) => {
        for (const a of Array.from(document.querySelectorAll('a[href]'))) {
          try {
            const href = (a as HTMLAnchorElement).href;
            if (href.endsWith(targetPath) || href.endsWith(targetPath + '/')) {
              (a as HTMLElement).setAttribute('data-do11y-test-nav', '1');
              return true;
            }
          } catch { /* ignore */ }
        }
        return false;
      }, gp);

      if (found) {
        await page.evaluate(() => {
          document
            .querySelector('[data-do11y-test-nav]')
            ?.scrollIntoView({ block: 'center' });
        });
        await sleep(300);
        await Promise.all([
          page.click('[data-do11y-test-nav]'),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout }).catch(() => {}),
        ]);
      } else {
        warn(`  ⚠ Could not find nav link to ${gp}, navigating directly`);
        await page.goto(gp, { waitUntil: 'networkidle2', timeout });
      }
    }
  } catch {
    warn('  ⚠ Navigation to guide page failed, continuing');
  }
  await sleep(1500);

  // 9. Click a TOC link on the guide page
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
}

// ─── Event extraction ───────────────────────────────────────────────────────

/**
 * Extract event objects from the sessionStorage records array.
 * Maps the OTel log record shape to the flat attribute format used
 * by the standalone test for consistent validation.
 */
function extractEvents(
  records: Array<{
    eventName?: string;
    attributes?: Record<string, unknown>;
  }>,
): Array<Record<string, unknown>> {
  return records.map((r) => ({
    eventName: r.eventName,
    ...(r.attributes ?? {}),
  }));
}

/**
 * Read and clear the test records from sessionStorage.
 */
async function readAndClearRecords(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const STORAGE_KEY = 'do11y_test_records';
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return stored ? JSON.parse(stored) : [];
  });
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('integration / instrumentation', () => {
  let browser: Browser;
  let server: StaticServer;

  beforeAll(async () => {
    // 1. Verify the build exists
    if (!fs.existsSync(INSTRUMENTATION_PATH)) {
      throw new Error(
        `dist/instrumentation/index.js not found at ${INSTRUMENTATION_PATH}. Run \`npm run build\` from the repo root first.`,
      );
    }

    // 2. Start a single server serving the project root.
    //    Both fixture pages and module scripts are same-origin, avoiding
    //    Chrome's Private Network Access restrictions.
    server = await createStaticServer(PROJECT_ROOT);

    // 3. Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: process.env.CI
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [],
    });

    // 4. Clean up any stale .otel.html files from a previously aborted run
    for (const file of fs.readdirSync(FIXTURES_DIR)) {
      if (file.endsWith('.otel.html')) {
        try { fs.unlinkSync(path.join(FIXTURES_DIR, file)); } catch { /* ignore */ }
      }
    }

    // 5. Generate .otel.html fixture files for each framework
    for (const framework of FRAMEWORKS) {
      generateOtelFixtureFiles(framework, server.url, FIXTURES_DIR);
    }

    // 6. Generate SPA test fixture (framework-agnostic, uses mintlify)
    generateSpaTestFixture(server.url, FIXTURES_DIR);

    // 7. Generate ordering regression fixture (provider registered after
    //    instrumentation construction)
    generateOrderingTestFixture(server.url, FIXTURES_DIR);
  });

  afterAll(async () => {
    // Clean up generated .otel.html files
    for (const framework of FRAMEWORKS) {
      for (const suffix of ['-start.otel.html', '-guide.otel.html']) {
        const filePath = path.join(FIXTURES_DIR, `${framework}${suffix}`);
        try {
          fs.unlinkSync(filePath);
        } catch {
          // File may not exist if beforeAll failed
        }
      }
    }
    // Clean up SPA fixture
    try {
      fs.unlinkSync(path.join(FIXTURES_DIR, 'spa-test.otel.html'));
    } catch {
      // File may not exist if beforeAll failed
    }
    // Clean up ordering fixture
    try {
      fs.unlinkSync(path.join(FIXTURES_DIR, 'ordering-test.otel.html'));
    } catch {
      // File may not exist if beforeAll failed
    }

    await browser.close();
    await server.close();
  });

  for (const framework of FRAMEWORKS) {
    it(`loads DocsInstrumentation and captures all event types on ${framework}`, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      // Capture console errors for debugging
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err instanceof Error ? err.message : String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') pageErrors.push(msg.text());
      });

      try {
        // Navigate to the generated start page (served from project root,
        // same origin as node_modules and dist — no CORS issues).
        const startUrl = `${server.url}/tests/integration/fixtures/${framework}-start.otel.html`;
        await page.goto(startUrl, {
          waitUntil: 'networkidle2',
          timeout: 15000,
        });

        // Wait for the instrumentation module to load and enable
        await page.waitForFunction(
          () => !!(window as any).__do11yTestInstrumentation,
          { timeout: 15000 },
        );
        await sleep(500);

        // Run the interaction sequence
        const guideUrl = `${server.url}/tests/integration/fixtures/${framework}-guide.otel.html`;
        await instrumentationInteractionSequence(page, {
          guidePath: guideUrl,
          pageLoadTimeout: 15000,
        });

        // Give pending async operations (scroll depth, etc.) time to flush
        await sleep(2000);

        // Trigger page_exit manually via beforeunload, then read records
        await page.evaluate(() => {
          window.dispatchEvent(new Event('beforeunload'));
        });
        await sleep(500);

        const rawRecords = await readAndClearRecords(page);
        expect(rawRecords.length).toBeGreaterThan(0);

        // Phase 1: Validate OTel log record envelope shape on the first record.
        // The instrumentation emits records with eventName, severityNumber,
        // attributes (object), and body (empty string). This checks our
        // contract with the OTel API layer.
        const firstRecord = rawRecords[0] as Record<string, unknown>;
        expect(firstRecord).toHaveProperty('eventName');
        expect(firstRecord.eventName).toBe('browser.do11y.page_view');
        expect(firstRecord).toHaveProperty('severityNumber', 9);
        expect(firstRecord).toHaveProperty('body', '');
        expect(firstRecord).toHaveProperty('attributes');
        expect(typeof firstRecord.attributes).toBe('object');

        const events = extractEvents(rawRecords as any[]);
        const eventNames = events
          .map((e: any) => e?.eventName as string | undefined)
          .filter((n): n is string => typeof n === 'string');

        // 1. Every expected event type should appear at least once
        for (const expected of EXPECTED_EVENT_TYPES) {
          if (
            expected === 'browser.do11y.feedback' &&
            FEEDBACK_NONE.has(framework)
          ) {
            continue;
          }
          expect(eventNames).toContain(expected);
        }

        // 2. page_view should fire at least twice (start + guide page)
        const pageViews = events.filter(
          (e: any) => e?.eventName === 'browser.do11y.page_view',
        );
        expect(pageViews.length).toBeGreaterThanOrEqual(2);

        // 3. Check payload shape on page_view events.
        //    The instrumentation emit includes browser context (from
        //    getBrowserContext()), page info (from getPageInfo()), and
        //    version. It does NOT include session.id — that is only
        //    added by the standalone transport layer.
        for (const pv of pageViews.slice(0, 2)) {
          expect(pv).toHaveProperty('url.path');
          expect(pv).toHaveProperty('browser.family');
          expect(pv).toHaveProperty('device.type');
          expect(pv).toHaveProperty('browser.language');
          expect(pv).toHaveProperty('browser.do11y.viewport_category');
          expect(pv).toHaveProperty('browser.do11y.page_title');
          expect(pv).toHaveProperty('browser.do11y.version');
        }

        // 4. page_exit event should have timing metrics
        const pageExits = events.filter(
          (e: any) => e?.eventName === 'browser.do11y.page_exit',
        );
        if (pageExits.length > 0) {
          expect(pageExits[0]).toHaveProperty(
            'browser.do11y.page_exit.total_time_seconds',
          );
          expect(pageExits[0]).toHaveProperty(
            'browser.do11y.page_exit.max_scroll_depth',
          );
          expect(pageExits[0]).toHaveProperty(
            'browser.do11y.referrer_category',
          );
        }

        // 5. code_copied events should have language and code index
        const codeCopied = events.filter(
          (e: any) => e?.eventName === 'browser.do11y.code_copied',
        );
        if (codeCopied.length > 0) {
          expect(codeCopied[0]).toHaveProperty(
            'browser.do11y.code.language',
          );
          expect(codeCopied[0]).toHaveProperty(
            'browser.do11y.code.index',
          );
        }

        // 6. At least one link_click should be from internal navigation
        const linkClicks = events.filter(
          (e: any) => e?.eventName === 'browser.do11y.link_click',
        );
        expect(linkClicks.length).toBeGreaterThanOrEqual(1);
        const internalNav = linkClicks.find(
          (e: any) =>
            e?.['browser.do11y.link.type'] === 'internal',
        );
        expect(internalNav).toBeDefined();
      } catch (err) {
        // Report captured page errors to help debug module loading failures
        if (pageErrors.length > 0) {
          console.error(`\n  Page errors for ${framework}:`);
          for (const e of pageErrors.slice(0, 10)) {
            console.error(`    ${e}`);
          }
        }
        throw err;
      } finally {
        await page.close();
      }
    }, 120000);
  }

  // ─── Phase 2: Disable integration test ──────────────────────────────────
  it('disable() stops emitting events in a real browser', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
      const startUrl = `${server.url}/tests/integration/fixtures/mintlify-start.otel.html`;
      await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.waitForFunction(
        () => !!(window as any).__do11yTestInstrumentation,
        { timeout: 15000 },
      );
      await sleep(500);

      // Clear any records emitted during init (first page_view, etc.)
      await readAndClearRecords(page);

      // Disable the instrumentation
      await page.evaluate(() => {
        (window as any).__do11yTestInstrumentation.disable();
      });
      await sleep(300);

      // Fire events that should NOT produce records after disable.
      // Note: beforeunload listeners added by setupEngagementTracking are
      // not removed by disable() — that's a known limitation tracked
      // separately. We test that click and scroll events are suppressed.
      await page.evaluate(() => {
        document.body.click();
        window.dispatchEvent(new Event('scroll'));
      });
      await sleep(500);

      const records = await readAndClearRecords(page);
      expect(records.length).toBe(0);
    } finally {
      await page.close();
    }
  }, 30000);

  // ─── Phase 3b: SPA path-change integration test ─────────────────────────
  it('emits page_exit + page_view on SPA navigation when trackSpaPathChanges is enabled', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
      const spaUrl = `${server.url}/tests/integration/fixtures/spa-test.otel.html`;
      await page.goto(spaUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Wait for both the instrumentation to initialize AND the SPA navigation
      // to complete (the page script simulates pushState after 500ms).
      await page.waitForFunction(
        () => !!(window as any).__do11ySpaNavigated,
        { timeout: 15000 },
      );
      await sleep(1000);

      // Trigger page_exit manually, then read records
      await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
      });
      await sleep(500);

      const rawRecords = await readAndClearRecords(page);
      const events = extractEvents(rawRecords as any[]);

      // Should have at least: initial page_view, SPA page_exit, SPA page_view
      const pageViews = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_view',
      );
      const pageExits = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_exit',
      );

      expect(pageViews.length).toBeGreaterThanOrEqual(2);
      expect(pageExits.length).toBeGreaterThanOrEqual(1);

      // The first page_view should be for the original path
      expect(pageViews[0]).toHaveProperty('url.path');
      expect(pageViews[0]?.['url.path']).toContain('/spa-test.otel.html');

      // A page_view with the SPA path should exist, with is_first_page: false
      const spaPageView = pageViews.find(
        (pv: any) => pv?.['url.path'] === '/spa-new-page',
      );
      expect(spaPageView).toBeDefined();
      expect(spaPageView?.['browser.do11y.is_first_page']).toBe(false);

      // page_exit fires with the *current* pathname at emission time, which
      // after the SPA navigation is the new path. This matches the behavior
      // of the standalone build's handlePathChange.
      expect(pageExits[0]).toHaveProperty('url.path');
      expect(pageExits[0]?.['url.path']).toBe('/spa-new-page');
      expect(pageExits[0]).toHaveProperty(
        'browser.do11y.page_exit.total_time_seconds',
      );
    } finally {
      await page.close();
    }
  }, 30000);

  // ─── Phase 3c: provider-after-instrumentation ordering regression ────────
  it('flows events when the LoggerProvider is registered after construction', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
      const url = `${server.url}/tests/integration/fixtures/ordering-test.otel.html`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.waitForFunction(
        () => !!(window as any).__do11yOrderingReady,
        { timeout: 15000 },
      );
      await sleep(500);

      // The initial page_view was emitted before the provider was registered
      // and must have been dropped; nothing should be stored yet.
      const before = await readAndClearRecords(page);
      expect(before.length).toBe(0);

      // Events emitted after registration must flow through the provider.
      await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
      });
      await sleep(500);

      const rawRecords = await readAndClearRecords(page);
      const events = extractEvents(rawRecords as any[]);

      const pageExits = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_exit',
      );
      expect(pageExits.length).toBeGreaterThanOrEqual(1);
      // Event name is carried by the top-level eventName field (OTel
      // event_name), not duplicated as an event.name attribute.
      expect(pageExits[0].eventName).toBe('browser.do11y.page_exit');
      expect(pageExits[0]).not.toHaveProperty('event.name');
      expect(pageExits[0]).toHaveProperty('session.id');
      expect(pageExits[0]).toHaveProperty('browser.do11y.session_page_count');
    } finally {
      await page.close();
    }
  }, 30000);
});
