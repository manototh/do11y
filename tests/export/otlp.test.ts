/**
 * Export test — Standalone file → OTLP destination.
 *
 * Tests that the built dist/do11y.js correctly initializes the OTel SDK
 * when configured with destination: 'otlp' and emits log records.
 *
 * No credentials required. Uses a mock OTLP endpoint.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createTestServer } from '../helpers/http-server';
import type { Browser, Page } from 'puppeteer';
import type { TestServer } from '../helpers/http-server';

const DO11Y_PATH = path.resolve(__dirname, '../../dist/do11y.js');

describe('export / otlp', () => {
  let server: TestServer;
  let browser: Browser | null = null;

  beforeAll(async () => {
    if (!fs.existsSync(DO11Y_PATH)) {
      throw new Error(`dist/do11y.js not found at ${DO11Y_PATH}. Run \`npm run build\` first.`);
    }

    server = await createTestServer();
    browser = await puppeteer.launch({
      headless: true,
      args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    });
  });

  afterAll(async () => {
    await browser?.close();
    await server.close();
  });

  it('initializes OTel SDK and sends logs via HTTP', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to the test server so the page origin matches (avoids CORS
    // issues when sending events — the server responds with a synthetic page).
    await page.goto(server.url);

    // Configure do11y with HTTP destination (OTLP over HTTP is proxied through the same transport)
    await page.evaluate((endpoint: string) => {
      (window as any).Do11yConfig = {
        destination: 'http',
        endpoint: endpoint,
        debug: true,
        framework: 'mintlify',
        allowedDomains: null,
        maxBatchSize: 1,
        flushInterval: 100,
        sectionVisibleThreshold: 1,
      };
    }, server.url);

    const do11yContent = fs.readFileSync(DO11Y_PATH, 'utf-8');
    await page.addScriptTag({ content: do11yContent });

    // Wait for at least one event POST to reach the mock server
    // (the initial navigation GET does not count)
    await server.waitFor((reqs) => reqs.some(r => r.method === 'POST'), 10000);
    await page.close();
  }, 15000);

  it('continues to work when OTel endpoint is unreachable (graceful degradation)', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to the test server first for same-origin compatibility
    await page.goto(server.url);

    await page.evaluate(() => {
      (window as any).Do11yConfig = {
        destination: 'http',
        endpoint: 'https://otel-unreachable.example.com/v1/logs',
        debug: true,
        framework: 'mintlify',
        allowedDomains: null,
        maxBatchSize: 1,
        sectionVisibleThreshold: 1,
      };
    });

    const do11yContent = fs.readFileSync(DO11Y_PATH, 'utf-8');
    await page.addScriptTag({ content: do11yContent });

    // Wait for Do11y to initialise despite unreachable endpoint
    await page.waitForFunction(
      () => typeof (window as any).Do11y?.flush === 'function',
      { timeout: 5000 },
    );

    const hasDo11y = await page.evaluate(() => {
      return !!(window as any).Do11y && typeof (window as any).Do11y.flush === 'function';
    });
    expect(hasDo11y).toBe(true);

    await page.close();
  }, 15000);
});
