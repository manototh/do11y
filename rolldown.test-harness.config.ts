import { defineConfig } from 'rolldown';

// Separate config for the test harness. Not included in the default
// rolldown.config.ts so that `npm run build` only produces production files.
export default defineConfig({
  input: 'tests/harness/index.ts',
  output: {
    file: 'tests/harness/do11y-test-harness.js',
    format: 'iife',
  },
});
