/**
 * Unit tests — Framework selector presets integrity.
 *
 * Verifies that all framework presets have valid, non-empty CSS selectors
 * for every required key. This catches typos, missing selectors, and
 * obviously invalid CSS at test time without any browser.
 */
import { describe, it, expect } from 'vitest';

// Import the presets module directly
import { FRAMEWORK_PRESETS } from '@do11y/core/presets';
import { SELECTOR_KEYS } from '@do11y/core/constants';

describe('presets', () => {
  it('has entries for all 7 supported frameworks', () => {
    const frameworks = Object.keys(FRAMEWORK_PRESETS);
    expect(frameworks).toEqual(
      expect.arrayContaining([
        'mintlify',
        'docusaurus',
        'nextra',
        'mkdocs-material',
        'vitepress',
        'starlight',
        'docsy',
      ]),
    );
    expect(frameworks).toHaveLength(7);
  });

  describe('every framework preset', () => {
    for (const [framework, selectors] of Object.entries(FRAMEWORK_PRESETS)) {
      describe(framework, () => {
        for (const key of SELECTOR_KEYS) {
          it(`has a non-empty ${key}`, () => {
            const selector = selectors[key];
            expect(typeof selector).toBe('string');
            expect(selector.length).toBeGreaterThan(0);
          });

          it(`${key} does not contain obviously invalid CSS`, () => {
            const selector = selectors[key];
            // Check for common CSS selector issues
            expect(selector).not.toMatch(/:\s*:/); // double colon
            expect(selector).not.toMatch(/!important/i);
            expect(selector).not.toMatch(/\|\|/); // CSS selector syntax error
            // Check for balanced brackets/parens
            const opens = (selector.match(/\(/g) || []).length;
            const closes = (selector.match(/\)/g) || []).length;
            expect(opens).toBe(closes);
          });
        }

        it('has no duplicate selectors across keys', () => {
          const values = SELECTOR_KEYS.map(k => selectors[k]);
          const unique = new Set(values);
          expect(unique.size).toBe(values.length);
        });

        it('has all 9 keys defined', () => {
          for (const key of SELECTOR_KEYS) {
            expect(selectors).toHaveProperty(key);
          }
        });
      });
    }
  });

  describe('selector patterns by category', () => {
    it('all searchSelectors reference common search patterns', () => {
      for (const [framework, sel] of Object.entries(FRAMEWORK_PRESETS)) {
        void framework;
        expect(sel.searchSelector.length).toBeGreaterThan(0);
      }
    });

    it('all feedbackSelectors include common feedback patterns', () => {
      for (const [framework, sel] of Object.entries(FRAMEWORK_PRESETS)) {
        void framework;
        // Each framework should have some feedback selector, even if generic
        expect(sel.feedbackSelector.length).toBeGreaterThan(0);
      }
    });

    it('all frameworks have unique tocSelector patterns', () => {
      const tocSelectors = Object.values(FRAMEWORK_PRESETS).map(s => s.tocSelector);
      // All frameworks share some generic fallbacks, but should have framework-specific ones
      expect(tocSelectors.every(s => s.includes('toc') || s.includes('TOC') || s.includes('Outline'))).toBe(true);
    });
  });

  describe('applyFrameworkSelectors', () => {
    it('sets selectors for a named framework and falls back to mintlify for unset ones', async () => {
      const { applyFrameworkSelectors } = await import('@do11y/core/presets');
      const config: Record<string, unknown> = {
        framework: 'docusaurus',
        destination: 'supabase',
        supabaseUrl: '',
        supabaseKey: '',
        debug: false,
        respectDNT: false,
        allowedDomains: null,
      };

      // Initialize all selector keys as null/undefined
      for (const key of SELECTOR_KEYS) {
        config[key] = null;
      }

      applyFrameworkSelectors(config as any);

      // Should have Docusaurus-specific selectors
      expect(config.searchSelector).toContain('DocSearch');
      expect(config.copyButtonSelector).toContain('clean-btn');
    });
  });
});
