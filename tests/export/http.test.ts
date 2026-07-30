/**
 * Export test — Standalone file loads and initialises correctly.
 *
 * Tests that the built dist/do11y.js loads in a browser, initialises
 * with a config, and exposes the expected Do11y public API.
 *
 * Body transforms are verified in the transport unit tests; this
 * test validates that the standalone file works end-to-end without
 * crashing when the endpoint is unreachable.
 *
 * No credentials required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import type { Browser } from 'puppeteer';

const DO11Y_PATH = path.resolve(__dirname, '../../dist/do11y.js');

describe('export / http', () => {
  let browser: Browser | null = null;

  beforeAll(async () => {
    if (!fs.existsSync(DO11Y_PATH)) {
      throw new Error(`dist/do11y.js not found at ${DO11Y_PATH}. Run \`npm run build\` first.`);
    }
    browser = await puppeteer.launch({
      headless: true,
      args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('loads and exposes the Do11y public API', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('about:blank');
    await page.evaluate(() => {
      (window as any).Do11yConfig = {
        destination: 'supabase',
        supabaseUrl: 'https://test-project.supabase.co',
        supabaseKey: 'sb-publishable-key-12345',
        supabaseTable: 'do11y_events',
        framework: 'mintlify',
        debug: false,
      };
    });

    await page.addScriptTag({ content: fs.readFileSync(DO11Y_PATH, 'utf-8') });
    await new Promise(r => setTimeout(r, 500));

    const api = await page.evaluate(() => {
      const d = (window as any).Do11y;
      return {
        hasGetConfig: typeof d?.getConfig === 'function',
        hasFlush: typeof d?.flush === 'function',
        hasIsEnabled: typeof d?.isEnabled === 'function',
        hasGetQueueSize: typeof d?.getQueueSize === 'function',
        version: d?.version,
      };
    });

    expect(api.hasGetConfig).toBe(true);
    expect(api.hasFlush).toBe(true);
    expect(api.hasIsEnabled).toBe(true);
    expect(api.hasGetQueueSize).toBe(true);
    expect(api.version).toBe('0.2.0');

    await page.close();
  });

  it('does not crash when the endpoint is unreachable', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('about:blank');
    await page.evaluate(() => {
      (window as any).Do11yConfig = {
        destination: 'supabase',
        supabaseUrl: 'https://nonexistent-project.supabase.co',
        supabaseKey: 'invalid-key',
        supabaseTable: 'do11y_events',
        framework: 'mintlify',
        debug: false,
      };
    });

    await page.addScriptTag({ content: fs.readFileSync(DO11Y_PATH, 'utf-8') });
    await new Promise(r => setTimeout(r, 1000));

    const isEnabled = await page.evaluate(() => (window as any).Do11y?.isEnabled());
    expect(isEnabled).toBe(true);

    await page.close();
  });
});
