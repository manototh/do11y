/**
 * Export test — SPA path change detection in the standalone build.
 *
 * Tests that the built dist/do11y.js correctly detects SPA navigations
 * via its handlePathChange mechanism (MutationObserver + popstate + polling)
 * and emits page_exit + page_view events with correct path metadata.
 *
 * No credentials required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createTestServer } from '../helpers/http-server';
import type { Browser } from 'puppeteer';
import type { TestServer, ReceivedRequest } from '../helpers/http-server';

const DO11Y_PATH = path.resolve(__dirname, '../../dist/do11y.js');

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

describe('export / spa', () => {
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

  it('emits page_exit + page_view on SPA navigation', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
      // Inject config + do11y.js via evaluateOnNewDocument so they run
      // on every page load (including after pushState navigations).
      const do11ySrc = fs.readFileSync(DO11Y_PATH, 'utf-8');
      await page.evaluateOnNewDocument(
        (url: string) => {
          (window as any).Do11yConfig = {
            destination: 'http',
            endpoint: url,
            debug: true,
            framework: 'custom',
            allowedDomains: null,
            maxBatchSize: 1,
            flushInterval: 100,
            sectionVisibleThreshold: 1,
            trackSpaPathChanges: true,
          };
        },
        server.url,
      );
      await page.evaluateOnNewDocument(do11ySrc);

      // Navigate to the mock server (same-origin) — this triggers init
      await page.goto(server.url, { waitUntil: 'networkidle2', timeout: 15000 });

      // Wait for Do11y to initialise
      await page.waitForFunction(
        () => typeof (window as any).Do11y?.getConfig === 'function',
        { timeout: 5000 },
      );

      // Wait for the initial page_view to be flushed
      await server.waitFor((reqs) => reqs.some(r => r.method === 'POST'), 5000);
      const initialRequests = server.getReceived().length;

      // Simulate SPA navigation: pushState + DOM content swap
      await page.evaluate(() => {
        // Update the path without a full navigation
        history.pushState({}, '', '/spa-new-page');
        document.title = 'SPA New Page';
        // Replace body content to trigger MutationObserver
        document.body.innerHTML = '<main><h1>New Page</h1><p>SPA content</p></main>';
      });

      // Wait for the path change to be detected and flushed
      await server.waitFor(
        (reqs) => reqs.length > initialRequests,
        10000,
      );

      // Collect all events
      const allRequests = server.getReceived();
      const events = collectEvents(allRequests);
      const eventNames = events
        .map((e: any) => e?.eventName)
        .filter((n): n is string => typeof n === 'string');

      // Should have at least: initial page_view, SPA page_exit, SPA page_view
      const pageViews = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_view',
      );
      const pageExits = events.filter(
        (e: any) => e?.eventName === 'browser.do11y.page_exit',
      );

      expect(pageViews.length).toBeGreaterThanOrEqual(2);
      expect(pageExits.length).toBeGreaterThanOrEqual(1);
      expect(eventNames).toContain('browser.do11y.page_exit');

      // The first page_view should be for the initial path
      expect(pageViews[0]).toHaveProperty('url.path');

      // At least one page_view should have the SPA path
      const spaPageView = pageViews.find(
        (pv: any) => pv?.['url.path'] === '/spa-new-page',
      );
      expect(spaPageView).toBeDefined();
      expect(spaPageView?.['browser.do11y.is_first_page']).toBe(false);

      // page_exit should reference the path that was exited
      const lastPageExit = pageExits[pageExits.length - 1] as any;
      expect(lastPageExit).toHaveProperty('browser.do11y.page_exit.total_time_seconds');
    } finally {
      await page.close();
    }
  }, 30000);
});
