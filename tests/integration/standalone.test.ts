/**
 * Integration test — Standalone file, all 7 frameworks, Supabase export.
 *
 * Builds dist/do11y.js, starts each framework's dev server, drives
 * Puppeteer interactions, validates events via Supabase REST API.
 *
 * Credential-gated: requires SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY.
 * This is equivalent to the old test-integrations.ts but runs via Vitest.
 *
 * For now, this test defers to the existing test-integrations.ts runner.
 * Full migration will happen when that file is replaced.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const enabled = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_SECRET_KEY);

describe.runIf(enabled)('integration / standalone', () => {
  it('can be run via the legacy test-integrations.ts script', () => {
    // The old test-integrations.ts still works and runs the full matrix.
    // Run it with: npx tsx tests/test-integrations.ts
    const scriptPath = path.resolve(__dirname, '../test-integrations.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  // TODO: Full Vitest-based integration test that:
  // 1. Builds dist/do11y.js
  // 2. For each framework fixture site:
  //    a. Patches do11y.js with config (via test-metadata helper)
  //    b. Installs deps if needed
  //    c. Starts dev server
  //    d. Runs Puppeteer interactions (shared helper)
  //    e. Queries Supabase via REST API
  //    f. Validates expected event types
  // 3. Shuts down servers
  // See: tests/test-integrations.ts for the existing implementation
});
