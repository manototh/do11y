#!/usr/bin/env node
/**
 * scripts/sync-test-sites.mjs
 *
 * Copies the freshly built dist/do11y.js into every example site so each
 * framework serves the latest bundle. Real files are used instead of
 * symlinks because symlinks don't work for:
 *   - Mintlify (cloud build from git — must be a committed real file)
 *   - Docsy / Hugo (doesn't reliably copy symlinked files in static/)
 *
 * Usage:
 *   node scripts/sync-test-sites.mjs           # one-shot copy
 *   node scripts/sync-test-sites.mjs --watch   # re-copy on every dist change
 *
 * Runs automatically via the `postbuild` npm script.
 */
import { watch } from 'node:fs';
import { access, copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'dist', 'do11y.js');

/** Relative target dirs per framework. */
const targets = [
  'tests/sites/docsy/static',         // Hugo copies static/ -> public/
  'tests/sites/docusaurus/static',
  'tests/sites/mkdocs-material/docs', // extra_javascript in mkdocs.yml
  'tests/sites/nextra/public',
  'tests/sites/starlight/public',
  'tests/sites/vitepress/public',
  'tests/sites/mintlify/scripts',     // Mintlify auto-loads JS from scripts/
];

async function sync() {
  for (const dir of targets) {
    const destDir = join(root, dir);
    const destFile = join(destDir, 'do11y.js');
    await mkdir(destDir, { recursive: true });
    // Remove any existing symlink first, so copyFile writes a real file
    // instead of following the link back into dist/.
    await rm(destFile, { force: true });
    await copyFile(source, destFile);
  }
  console.log(`[sync-test-sites] copied do11y.js to ${targets.length} sites`);
}

try {
  await access(source); // fail fast with a helpful message if not built
} catch {
  console.error('[sync-test-sites] dist/do11y.js not found. Run `npm run build` first.');
  process.exit(1);
}

if (process.argv.includes('--watch')) {
  await sync();
  let timer;
  watch(join(root, 'dist'), { persistent: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => sync().catch(console.error), 100);
  });
  console.log('[sync-test-sites] watching dist/ for changes… (Ctrl+C to stop)');
} else {
  await sync();
}
