import { defineConfig } from 'rolldown';

export default defineConfig([
  // ── Standalone IIFE (script tag distribution) ──────────────────────────
  {
    input: 'src/standalone/index.ts',
    output: {
      file: 'dist/do11y.js',
      format: 'iife',
      name: 'Do11yBundle',
    },
  },
  {
    input: 'src/standalone/index.ts',
    output: {
      file: 'dist/do11y.min.js',
      format: 'iife',
      name: 'Do11yBundle',
      minify: true,
    },
  },
  // ── OTel Instrumentation ESM (npm distribution) ────────────────────────
  {
    input: 'src/instrumentation/index.ts',
    output: {
      dir: 'dist/instrumentation',
      format: 'esm',
      entryFileNames: 'index.js',
    },
    external: [
      '@opentelemetry/instrumentation',
      '@opentelemetry/api-logs',
    ],
  },
  // ── Test harness IIFE (for Puppeteer-based instrumentation tests) ─────
  {
    input: 'tests/harness/index.ts',
    output: {
      file: 'tests/harness/do11y-test-harness.js',
      format: 'iife',
    },
    // Bundle all deps — the harness is a test-only artifact, not for
    // distribution, so there's no need to externalize anything.
    external: [],
  },
]);
