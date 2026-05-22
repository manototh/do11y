import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/do11y.ts',
    output: {
      file: 'dist/do11y.js',
      format: 'iife',
      name: 'AxiomDo11yBundle',
    },
  },
  {
    input: 'src/do11y.ts',
    output: {
      file: 'dist/do11y.min.js',
      format: 'iife',
      name: 'AxiomDo11yBundle',
      minify: true,
    },
  },
]);
