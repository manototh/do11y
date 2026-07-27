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
]);
