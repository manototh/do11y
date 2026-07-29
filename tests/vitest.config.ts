/**
 * Do11y — Documentation Observability
 *
 * Vitest configuration for the redesigned test framework.
 *
 * Projects:
 *   unit              — Fast unit tests (tracking modules, core, transport). No browser, no credentials.
 *   selector-snapshots — CSS drift detection against static fixtures + live sites.
 *   export            — Export destination tests (HTTP, OTLP, instrumentation-otel, supabase).
 *   integration       — Full E2E tests against all 7 frameworks (credential-gated).
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'sites'],
    env: {
      DO11Y_VERSION: '0.2.0',
    },
  },
  resolve: {
    alias: {
      '@do11y/core': path.join(ROOT, 'src', 'core'),
      '@do11y/standalone': path.join(ROOT, 'src', 'standalone'),
      '@do11y/instrumentation': path.join(ROOT, 'src', 'instrumentation'),
    },
  },
});
