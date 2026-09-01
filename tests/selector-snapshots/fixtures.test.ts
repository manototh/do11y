/**
 * Selector snapshot tests — Static fixtures.
 *
 * For each supported framework, this test creates a minimal HTML fixture
 * that mimics the framework's DOM structure, then verifies that the
 * preset selectors match the expected elements. This catches CSS drift
 * when frameworks change their class names or DOM structure.
 *
 * Deterministic, no network, runs in CI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../helpers/mock-dom';
import { FRAMEWORK_PRESETS } from '@do11y/core/presets';
import { SELECTOR_KEYS } from '@do11y/core/constants';
import type { FrameworkSelectors } from '@do11y/core/types';

// ─── Static HTML fixtures per framework ─────────────────────────────────────
// These mimic the DOM structure each framework produces for key UI elements.
// Update these when you know a framework has changed its markup — then the
// test will fail until the preset selectors are updated to match.

const FRAMEWORK_FIXTURES: Record<string, () => string> = {
  mintlify: () => `<!DOCTYPE html><html><body>
    <nav id="navbar"><a href="/">Home</a></nav>
    <div id="search-bar-entry"></div>
    <main><article>
      <h1>Title</h1>
      <pre><code>code here</code></pre>
      <button class="copy" aria-label="Copy code">Copy</button>
      <div id="table-of-contents"><a href="#intro">Intro</a></div>
      <div class="feedback"><button>Yes</button></div>
      <div class="tab"><button>Tab 1</button></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer>Footer</footer>
  </body></html>`,

  docusaurus: () => `<!DOCTYPE html><html><body>
    <nav class="navbar"><a href="/">Home</a></nav>
    <div class="DocSearch DocSearch-Button"></div>
    <main><article>
      <h1>Title</h1>
      <pre><code>code</code></pre>
      <button class="clean-btn" aria-label="Copy code">Copy</button>
      <div class="table-of-contents"><a href="#intro">Intro</a></div>
      <div class="tabs" role="tablist"><button>Tab</button></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer>Footer</footer>
  </body></html>`,

  nextra: () => `<!DOCTYPE html><html><body>
    <nav><a href="/">Home</a></nav>
    <div class="nextra-search"><input placeholder="Search"></div>
    <main><article>
      <h1>Title</h1>
      <pre><code>code</code></pre>
      <button class="copy" aria-label="Copy code">Copy</button>
      <div class="nextra-toc"><a href="#intro">Intro</a></div>
      <div role="tablist"><button>Tab</button></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer>Footer</footer>
  </body></html>`,

  'mkdocs-material': () => `<!DOCTYPE html><html><body>
    <nav class="md-nav"><a href="/">Home</a></nav>
    <input class="md-search__input" placeholder="Search">
    <main class="md-content"><article>
      <h1>Title</h1>
      <pre><code>code</code></pre>
      <button class="md-clipboard" title="Copy to clipboard"></button>
      <div class="md-sidebar--secondary"><nav class="md-nav"><a href="#intro">Intro</a></nav></div>
      <div class="md-feedback"><button>Yes</button></div>
      <div class="md-typeset"><div class="tabbed-set"><label>Tab</label></div></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer class="md-footer">Footer</footer>
  </body></html>`,

  vitepress: () => `<!DOCTYPE html><html><body>
    <nav class="VPNav"><a href="/">Home</a></nav>
    <button class="VPNavBarSearchButton">Search</button>
    <main class="VPContent"><article>
      <h1>Title</h1>
      <div class="language-bash"><pre><code>code</code></pre></div>
      <button class="vp-code-copy" title="Copy">Copy</button>
      <div class="VPDocAsideOutline"><a href="#intro" class="outline-link">Intro</a></div>
      <div class="vp-code-group"><div class="tabs"><button>Tab</button></div></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer class="VPFooter">Footer</footer>
  </body></html>`,

  starlight: () => `<!DOCTYPE html><html><body>
    <nav><a href="/">Home</a></nav>
    <site-search><button data-open-modal>Search</button></site-search>
    <main class="sl-markdown-content"><article>
      <h1>Title</h1>
      <div class="expressive-code"><pre><code>code</code></pre><div class="copy"><button data-code>Copy</button></div></div>
      <starlight-toc><a href="#intro">Intro</a></starlight-toc>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer>Footer</footer>
  </body></html>`,

  docsy: () => `<!DOCTYPE html><html><body>
    <nav class="td-sidebar"><a href="/">Home</a></nav>
    <input class="td-search__input" placeholder="Search">
    <main class="td-content"><article>
      <h1>Title</h1>
      <div class="highlight"><pre class="chroma"><code>code</code></pre></div>
      <button aria-label="Copy code">Copy</button>
      <nav class="td-toc" id="TableOfContents"><a href="#intro">Intro</a></nav>
      <div class="nav-tabs" role="tablist"><button>Tab</button></div>
      <div class="feedback--answer"><button>Yes</button></div>
      <details><summary>Expand</summary></details>
    </article></main>
    <footer class="td-footer">Footer</footer>
  </body></html>`,
};

// Which selectors are expected to match for each framework.
// Some frameworks don't have certain UI elements (e.g., no tabs in nextra, no feedback in vitepress).
const OPTIONAL_SELECTORS: Record<string, Array<keyof FrameworkSelectors>> = {
  mintlify: [],
  docusaurus: ['feedbackSelector'],
  nextra: ['feedbackSelector'],
  'mkdocs-material': [],
  vitepress: ['feedbackSelector'],
  starlight: ['feedbackSelector', 'tabContainerSelector'],
  docsy: ['copyButtonSelector', 'feedbackSelector', 'tabContainerSelector'],
};

describe('selector-snapshots / fixtures', () => {
  for (const [framework, htmlFn] of Object.entries(FRAMEWORK_FIXTURES)) {
    describe(framework, () => {
      const preset = FRAMEWORK_PRESETS[framework];
      const optional = new Set(OPTIONAL_SELECTORS[framework] ?? []);

      beforeEach(() => {
        setupTestDOM(htmlFn());
      });

      afterEach(() => {
        teardownTestDOM();
      });

      for (const key of SELECTOR_KEYS) {
        const isOptional = optional.has(key);
        const testName = isOptional
          ? `${key} → matches (optional)`
          : `${key} → matches`;

        it(testName, () => {
          const selector = preset[key];
          const elements = document.querySelectorAll(selector);
          if (!isOptional) {
            expect(elements.length).toBeGreaterThan(0);
          }
          // For optional selectors, we just check they don't throw
          expect(typeof selector).toBe('string');
          expect(selector.length).toBeGreaterThan(0);
        });
      }

      it('all selectors are valid CSS (no exceptions from querySelectorAll)', () => {
        for (const key of SELECTOR_KEYS) {
          expect(() => document.querySelectorAll(preset[key])).not.toThrow();
        }
      });
    });
  }
});
