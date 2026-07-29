/**
 * Integration test — Standalone file, all 7 framework fixtures.
 *
 * Loads dist/do11y.js in Puppeteer against representative HTML fixtures
 * for each supported documentation framework, drives the full interaction
 * sequence (TOC click, scroll, search, code copy, expand, feedback,
 * navigation, page exit), and validates that the expected event types
 * are emitted via the HTTP transport to a local mock server.
 *
 * No credentials required. No framework dev servers. Runs in ~30s.
 *
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createTestServer } from '../helpers/http-server';
import { runInteractions, sleep } from '../helpers/puppeteer-interactions';
import type { Browser } from 'puppeteer';
import type { TestServer, ReceivedRequest } from '../helpers/http-server';

const DO11Y_PATH = path.resolve(__dirname, '../../dist/do11y.js');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

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

// Frameworks whose default UI does not include a feedback widget.
const FEEDBACK_NONE = new Set(['docusaurus', 'nextra', 'vitepress', 'starlight']);

/**
 * Extract individual event objects from the mock server's received requests.
 * The HTTP destination sends events as a JSON array in the request body.
 */
function collectEvents(requests: ReceivedRequest[]): Record<string, unknown>[] {
  return requests.flatMap(r => {
    try {
      const body = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
      return Array.isArray(body) ? body : [body];
    } catch {
      return [];
    }
  });
}

describe('integration / standalone', () => {
  let browser: Browser;
  let server: TestServer;

  beforeAll(async () => {
    if (!fs.existsSync(DO11Y_PATH)) {
      throw new Error(
        `dist/do11y.js not found at ${DO11Y_PATH}. Run \`npm run build\` from the repo root first.`,
      );
    }
    server = await createTestServer();
    browser = await puppeteer.launch({
      headless: true,
      args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    });
  });

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  for (const framework of FRAMEWORKS) {
    it(`loads do11y.js and captures all event types on ${framework}`, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      // Build the patched script: config block + do11y.js source
      // This is injected via evaluateOnNewDocument so it runs on every
      // page load (start page → guide page navigation), just like a
      // real script-tag deployment.
      const do11ySrc = fs.readFileSync(DO11Y_PATH, 'utf-8');
      const configBlock = `
window.Do11yConfig = {
  destination: 'http',
  endpoint: '${server.url}',
  debug: true,
  framework: '${framework}',
  allowedDomains: null,
  maxBatchSize: 10,
  flushInterval: 200,
  sectionVisibleThreshold: 1,
};
`;
      await page.evaluateOnNewDocument(configBlock + do11ySrc);

      // Navigate to the start fixture page
      const startUrl = `file://${path.join(FIXTURES_DIR, `${framework}-start.html`)}`;
      await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Run the full interaction sequence (navigates to guide page, then closes)
      const guideUrl = `file://${path.join(FIXTURES_DIR, `${framework}-guide.html`)}`;
      await runInteractions(page, { guidePath: guideUrl, pageLoadTimeout: 15000 });

      // Give pending flushes time to reach the mock server
      await sleep(3000);

      // Collect all events from the mock server
      const requests = server.getReceived();
      const events = collectEvents(requests);
      const eventNames = events
        .map((e: any) => e?.eventName)
        .filter((n): n is string => typeof n === 'string');

      // 1. Every expected event type should appear at least once
      for (const expected of EXPECTED_EVENT_TYPES) {
        // Feedback is optional for frameworks that don't ship a feedback widget
        if (expected === 'browser.do11y.feedback' && FEEDBACK_NONE.has(framework)) {
          continue;
        }
        expect(eventNames).toContain(expected);
      }

      // 2. page_view should fire at least twice (start + guide page)
      const pageViews = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_view',
      );
      expect(pageViews.length).toBeGreaterThanOrEqual(2);

      // 3. Check payload shape on page_view events
      for (const pv of pageViews.slice(0, 2)) {
        expect(pv).toHaveProperty('url.path');
        expect(pv).toHaveProperty('session.id');
        expect(pv).toHaveProperty('browser.family');
        expect(pv).toHaveProperty('device.type');
        expect(pv).toHaveProperty('browser.language');
        expect(pv).toHaveProperty('browser.do11y.viewport_category');
        expect(pv).toHaveProperty('browser.do11y.page_title');
      }

      // 4. page_exit event should have timing metrics
      const pageExits = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_exit',
      );
      if (pageExits.length > 0) {
        expect(pageExits[0]).toHaveProperty('browser.do11y.page_exit.total_time_seconds');
        expect(pageExits[0]).toHaveProperty('browser.do11y.page_exit.max_scroll_depth');
        expect(pageExits[0]).toHaveProperty('browser.do11y.referrer_category');
      }

      // 5. code_copied events should have language and code index
      const codeCopied = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.code_copied',
      );
      if (codeCopied.length > 0) {
        expect(codeCopied[0]).toHaveProperty('browser.do11y.code.language');
        expect(codeCopied[0]).toHaveProperty('browser.do11y.code.index');
      }

      // 6. link_click events should have link type
      const linkClicks = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.link_click',
      );
      if (linkClicks.length > 0) {
        expect(linkClicks[0]).toHaveProperty('browser.do11y.link.type');
      }

      // Reset the server log for the next framework
      server.clear();
    }, 90000);
  }
});
