/**
 * Do11y instrumentation unit tests.
 *
 * Tests DocsInstrumentation configuration, framework preset application,
 * and enable/disable lifecycle in isolation — no browser or doc site needed.
 *
 * Run: npx tsx test-instrumentation-unit.ts
 */

import { buildConfig } from '../src/instrumentation/config.js';
import type { DocsInstrumentationConfig } from '../src/instrumentation/config.js';

// ─── Test counters ───────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}`);
    fail++;
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual === expected) {
    console.log(`  ✅ ${label} (${JSON.stringify(actual)})`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail++;
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: expected ${e}, got ${a}`);
    fail++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\n── buildConfig ────────────────────────────────────────────\n');

// Test 1: defaults
{
  const config = buildConfig({});
  assertEqual(config.framework, 'mintlify', 'default framework is mintlify');
  assertEqual(config.debug, false, 'default debug is false');
  assertEqual(config.trackScrollDepth, true, 'default trackScrollDepth is true');
  assertEqual(config.trackFeedback, true, 'default trackFeedback is true');
  assertDeepEqual(config.scrollThresholds, [25, 50, 75, 90], 'default scrollThresholds');
  assertEqual(config.sectionVisibleThreshold, 3, 'default sectionVisibleThreshold');
}

// Test 2: explicit overrides
{
  const config = buildConfig({
    framework: 'vitepress',
    debug: true,
    trackScrollDepth: false,
    scrollThresholds: [10, 20],
    sectionVisibleThreshold: 5,
  });
  assertEqual(config.framework, 'vitepress', 'framework override');
  assertEqual(config.debug, true, 'debug override');
  assertEqual(config.trackScrollDepth, false, 'trackScrollDepth override');
  assertDeepEqual(config.scrollThresholds, [10, 20], 'scrollThresholds override');
  assertEqual(config.sectionVisibleThreshold, 5, 'sectionVisibleThreshold override');
}

// Test 3: selector overrides via selectors object
{
  const config = buildConfig({
    selectors: {
      searchSelector: '#my-search',
      tocSelector: '.my-toc',
    },
  });
  assertEqual(config.searchSelector, '#my-search', 'searchSelector override');
  assertEqual(config.tocSelector, '.my-toc', 'tocSelector override');
  // Non-overridden selectors should be null
  assertEqual(config.feedbackSelector, null, 'feedbackSelector default null');
}

// Test 4: all tracking toggles
{
  const config = buildConfig({
    trackTabSwitches: false,
    trackTocClicks: false,
    trackExpandCollapse: false,
    trackInternalLinks: false,
    trackOutboundLinks: false,
    trackSectionVisibility: false,
  });
  assertEqual(config.trackTabSwitches, false, 'trackTabSwitches false');
  assertEqual(config.trackTocClicks, false, 'trackTocClicks false');
  assertEqual(config.trackExpandCollapse, false, 'trackExpandCollapse false');
  assertEqual(config.trackInternalLinks, false, 'trackInternalLinks false');
  assertEqual(config.trackOutboundLinks, false, 'trackOutboundLinks false');
  assertEqual(config.trackSectionVisibility, false, 'trackSectionVisibility false');
}

// Test 5: custom framework
{
  const config = buildConfig({ framework: 'custom' });
  assertEqual(config.framework, 'custom', 'custom framework preserved');
}

console.log('\n── Framework preset selectors ──────────────────────────────\n');

// Test 6: applyFrameworkSelectors for each known framework
// We access the internal preset function via the module reference
import { applyFrameworkSelectors } from '../src/core/presets.js';

const FRAMEWORKS = ['mintlify', 'docusaurus', 'nextra', 'mkdocs-material', 'vitepress', 'starlight', 'docsy'] as const;

for (const fw of FRAMEWORKS) {
  const cfg: Record<string, unknown> = { framework: fw };
  applyFrameworkSelectors(cfg as any);
  assert(typeof cfg.searchSelector === 'string' && cfg.searchSelector.length > 0,
    `${fw}: searchSelector populated`);
  assert(typeof cfg.copyButtonSelector === 'string' && cfg.copyButtonSelector.length > 0,
    `${fw}: copyButtonSelector populated`);
  assert(typeof cfg.codeBlockSelector === 'string' && cfg.codeBlockSelector.length > 0,
    `${fw}: codeBlockSelector populated`);
  assert(typeof cfg.navigationSelector === 'string' && cfg.navigationSelector.length > 0,
    `${fw}: navigationSelector populated`);
  assert(typeof cfg.contentSelector === 'string' && cfg.contentSelector.length > 0,
    `${fw}: contentSelector populated`);
}

// Test 7: custom framework with explicit selectors
{
  const cfg: Record<string, unknown> = { framework: 'custom', searchSelector: '#my-search' };
  applyFrameworkSelectors(cfg as any);
  assertEqual(cfg.searchSelector, '#my-search', 'custom framework keeps explicit selector');
}

// Test 8: explicit selectors override presets
{
  const cfg: Record<string, unknown> = { framework: 'mintlify', searchSelector: '#override' };
  applyFrameworkSelectors(cfg as any);
  assertEqual(cfg.searchSelector, '#override', 'explicit selector overrides preset');
}

console.log('\n── Instrumentation lifecycle (static) ──────────────────────\n');

// Test 9: DocsInstrumentation class exists and has expected shape
import { DocsInstrumentation } from '../src/instrumentation/index.js';

{
  assert(typeof DocsInstrumentation === 'function', 'DocsInstrumentation is a class/function');
  // Check static shape without instantiation (constructor calls enable() which needs DOM)
  assert(typeof DocsInstrumentation.prototype.enable === 'function', 'enable() method exists');
  assert(typeof DocsInstrumentation.prototype.disable === 'function', 'disable() method exists');
}

// Test 10: can create instance with minimal DOM stubs
// The InstrumentationBase constructor calls enable(), which needs browser APIs.
// We provide minimal stubs so the class can be instantiated.
{
  // Set up minimal DOM stubs
  (globalThis as any).window = {
    location: { pathname: '/test', hash: '', search: '' },
    innerWidth: 1440,
    innerHeight: 900,
    scrollY: 0,
    addEventListener: () => {},
    requestAnimationFrame: (cb: Function) => setTimeout(cb, 0),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  };
  (globalThis as any).document = {
    title: 'Test Page',
    referrer: '',
    cookie: '',
    documentElement: { scrollHeight: 2000 },
    body: { scrollHeight: 2000 },
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({}),
  };
  (globalThis as any).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  // navigator is read-only, use defineProperty
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Node.js', language: 'en-US' },
    configurable: true,
    writable: true,
  });
  (globalThis as any).CSS = { escape: (s: string) => s, supports: () => false };
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };

  try {
    const inst = new DocsInstrumentation({ framework: 'mintlify', debug: false });
    assert(inst.instrumentationName === '@manototh/do11y', 'instrumentationName is set');
    assert(!!inst.instrumentationVersion, 'instrumentationVersion is set');
    inst.disable();
    assert(true, 'DocsInstrumentation instantiated with minimal DOM stubs');
  } catch (err) {
    assert(false, `instantiation threw: ${(err as Error).message}`);
  }
}

// Test 11: init returns void (no Node.js module patching)
{
  const inst = new DocsInstrumentation();
  const result = inst.init();
  assert(result === undefined || result === null || (Array.isArray(result) && result.length === 0),
    'init() returns void/empty');
}

// Test 12: double disable should not throw
{
  const inst = new DocsInstrumentation({ framework: 'mintlify' });
  try {
    inst.disable();
    inst.disable();
    assert(true, 'double disable() does not throw');
  } catch (err) {
    assert(false, `double disable threw: ${(err as Error).message}`);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
console.log(`${'='.repeat(50)}`);

process.exit(fail > 0 ? 1 : 0);
