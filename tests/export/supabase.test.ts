/**
 * Export test — Standalone file → Supabase destination (smoke test).
 *
 * Tests that the built dist/do11y.js loads and initialises with
 * Supabase config without crashing. Requires SUPABASE_URL and
 * SUPABASE_KEY in .env. Gated on those env vars.
 *
 * Full integration tests with Supabase query verification are in
 * the old test-integrations.ts (kept until Phase 8 cleanup).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import type { Browser } from 'puppeteer';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const DO11Y_PATH = path.resolve(__dirname, '../../dist/do11y.js');

const enabled = !!(SUPABASE_URL && SUPABASE_KEY);

describe.runIf(enabled)('export / supabase', () => {
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

  it('loads and initialises with Supabase config without crashing', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('about:blank');
    await page.evaluate(
      (url: string, key: string) => {
        (window as any).Do11yConfig = {
          destination: 'supabase',
          supabaseUrl: url,
          supabaseKey: key,
          supabaseTable: 'do11y_events',
          framework: 'mintlify',
          debug: false,
        };
      },
      SUPABASE_URL!,
      SUPABASE_KEY!,
    );

    await page.addScriptTag({ content: fs.readFileSync(DO11Y_PATH, 'utf-8') });
    await new Promise(r => setTimeout(r, 500));

    const hasDo11y = await page.evaluate(() => {
      const d = (window as any).Do11y;
      return typeof d?.isEnabled === 'function' && d?.isEnabled() === true;
    });
    expect(hasDo11y).toBe(true);

    await page.close();
  });
});
