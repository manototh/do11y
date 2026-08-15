/**
 * Selector snapshot tests — Live production sites.
 *
 * For each supported framework, this test loads a real production
 * documentation page and verifies that the preset selectors match
 * actual DOM elements. This catches real-world CSS drift when
 * frameworks release new versions with changed class names.
 *
 * These tests require network access. Gate with TEST_LIVE=1 env var.
 * Runs in CI as a fast external check (<30s for all 7 sites).
 */
import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import { FRAMEWORK_PRESETS } from '@do11y/core/presets';
import { SELECTOR_KEYS } from '@do11y/core/constants';
import type { Browser } from 'puppeteer';
import type { FrameworkSelectors } from '@do11y/core/types';

// Live URLs for each framework — pages known to have code blocks, TOC, etc.
const LIVE_URLS: Record<string, string> = {
  mintlify: 'https://www.mintlify.com/docs/components/tabs',
  docusaurus: 'https://docusaurus.io/docs/next/swizzling',
  nextra: 'https://nextra.site/docs/docs-theme/start',
  'mkdocs-material': 'https://squidfunk.github.io/mkdocs-material/reference/admonitions',
  vitepress: 'https://vitepress.dev/guide/markdown',
  starlight: 'https://starlight.astro.build/getting-started/',
  docsy: 'https://www.docsy.dev/docs/content/iconsimages/',
};

// Optional selectors per framework (may not be present on the test page)
const OPTIONAL_SELECTORS: Record<string, Array<keyof FrameworkSelectors>> = {
  mintlify: [],
  docusaurus: ['feedbackSelector'],
  nextra: ['feedbackSelector'],
  'mkdocs-material': [],
  vitepress: ['feedbackSelector'],
  starlight: ['feedbackSelector', 'tabContainerSelector'],
  docsy: ['copyButtonSelector', 'feedbackSelector', 'tabContainerSelector'],
};

interface SelectorResult {
  key: keyof FrameworkSelectors;
  matched: number;
  ok: boolean;
}

interface FrameworkResult {
  framework: string;
  url: string;
  results: SelectorResult[];
  error?: string;
}

const RESULTS: FrameworkResult[] = [];

describe('selector-snapshots / live-sites', () => {
  const isEnabled = process.env.TEST_LIVE === '1';
  it.runIf(isEnabled)('validates selectors against live production sites', async () => {
    const browser = await puppeteer.launch({ headless: true });

    for (const [name, url] of Object.entries(LIVE_URLS)) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      const preset = FRAMEWORK_PRESETS[name];
      const optional = new Set(OPTIONAL_SELECTORS[name] ?? []);
      const results: SelectorResult[] = [];

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000)); // extra wait for JS render

        const matches = await page.evaluate(
          (sels: Record<string, string>, keys: string[]) => {
            return keys.map(key => {
              try {
                const els = document.querySelectorAll(sels[key]!);
                return { key, matched: els.length };
              } catch {
                return { key, matched: -1 }; // invalid selector
              }
            });
          },
          preset as unknown as Record<string, string>,
          SELECTOR_KEYS as unknown as string[],
        );

        for (const m of matches) {
          const isOptional = optional.has(m.key as keyof FrameworkSelectors);
          const ok = isOptional || m.matched > 0;
          results.push({
            key: m.key as keyof FrameworkSelectors,
            matched: m.matched,
            ok,
          });
        }
      } catch (err) {
        RESULTS.push({
          framework: name,
          url,
          results: [],
          error: (err as Error).message,
        });
        await page.close();
        continue;
      }

      await page.close();
      RESULTS.push({ framework: name, url, results });
    }

    await browser.close();

    // Report results
    let allPassed = true;
    for (const result of RESULTS) {
      console.log(`\n${result.framework} (${result.url})`);
      if (result.error) {
        console.log(`  ❌ Load error: ${result.error}`);
        allPassed = false;
        continue;
      }
      for (const r of result.results) {
        const icon = r.ok ? '✅' : '❌';
        console.log(`  ${icon} ${r.key.padEnd(22)} ${r.matched} matches`);
        if (!r.ok) allPassed = false;
      }
    }

    expect(allPassed).toBe(true);
  }, 120_000); // 2 min timeout for all 7 sites
});
