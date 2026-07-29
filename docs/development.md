---
title: Development
description: How to run the Do11y test suites and create a new release.
head:
  - - meta
    - property: og:title
      content: Development — Do11y
  - - meta
    - property: og:description
      content: How to run the Do11y test suites and create a new release.
---

# Development

## Project structure

```
src/
  core/               ← Shared logic: types, constants, framework presets,
  │                      DOM utilities, session management, context,
  │                      and 11 tracking modules (scroll, links, tabs, etc.)
  standalone/         ← Script-tag distribution. Adds event queue,
  │                      batching, HTTP/Supabase/OTLP transport.
  instrumentation/    ← npm OTel instrumentation. DocsInstrumentation
                         extends InstrumentationBase from @opentelemetry/
                         instrumentation.
```

The `src/standalone/` entry produces `dist/do11y.js` and `dist/do11y.min.js` (IIFE for script tags).  
The `src/instrumentation/` entry produces `dist/instrumentation/index.js` (ESM for bundlers).

## Build

```bash
npm run build              # Build all outputs
npm run build:standalone   # Build only the standalone IIFE
npm run build:instrumentation  # Build only the ESM instrumentation
```

## Tests

The test suite is organized in layers, each catching a different class of failure:

| What broke | Which test catches it | Speed | Credentials |
|---|---|---|---|
| Tracking module logic bug | Unit tests (core + tracking) | < 1s | None |
| Transport queuing / flush / retry | Transport unit tests | < 1s | None |
| Framework CSS class rename (drift) | Selector snapshot fixtures | < 1s | None |
| Real-world CSS drift on production | Selector snapshot live-sites (~30s) | ~30s | None (`TEST_LIVE=1`) |
| Standalone file doesn't load/export | Export tests (HTTP/OTLP) | ~5s | None |
| Instrumentation doesn't emit events | Export tests (instrumentation-otel) | < 1s | None |
| Supabase export broken | Export smoke test | ~3s | `SUPABASE_*` |
| Full E2E across all 7 frameworks | Legacy integration tests | ~5m | `SUPABASE_*` |
| SQL query correctness | `test-queries.ts` | ~10s | `SUPABASE_*` |

### Quick start

All new tests use **Vitest**. Run them from the `tests/` directory:

```bash
cd tests
npm install
npx puppeteer browsers install chrome   # if not already installed
```

Run all new tests (no credentials needed):

```bash
npm test
```

### Test suites

| Command | What runs | Credentials |
|---|---|---|
| `npm test` | All unit + selector + export suites | None |
| `npm run test:unit` | Core + tracking + transport unit tests (321 tests) | None |
| `npm run test:selectors` | Framework selector fixture tests (70 tests) | None |
| `npm run test:export` | HTTP, OTLP, instrumentation-otel export tests | None |
| `npm run test:supabase` | Supabase smoke test | `SUPABASE_URL`, `SUPABASE_KEY` |
| `npm run test:live-selectors` | Live-site CSS drift check | None (but network) |
| `npm run test:all` | All suites, verbose output | Varies |

### Unit tests (fast, no browser, no credentials)

321 tests across 18 files:

- **6 core files** — constants, session, context, privacy, dom-utils, presets
- **11 tracking files** — page-view, scroll, links, search, copy, sections, tabs, toc, feedback, expand, engagement
- **1 transport file** — queue, flush, retry, body transforms, config validation

```bash
npm run test:unit
```

### Selector snapshot tests (CSS drift detection)

The **fixture tests** load static HTML that mimics each framework's DOM structure and verify all preset selectors match. If a framework changes its CSS class names, these tests fail before the change reaches production.

```bash
npm run test:selectors
```

The **live-site tests** do the same against real production URLs. Gated on `TEST_LIVE=1`:

```bash
TEST_LIVE=1 npm run test:live-selectors
```

### Export tests (no credentials)

Verify that the built standalone and instrumentation files correctly send events to their configured destinations:

```bash
npm run test:export
```

### Supabase smoke test (optional)

Requires `SUPABASE_URL` and `SUPABASE_KEY` in `tests/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=sb_publishable_your_key
```

```bash
npm run test:supabase
```

### Legacy test runners (still available)

The old test runners remain available for full E2E validation. They require Supabase credentials:

- `npm run test-integrations` — All 7 frameworks against local dev servers
- `npm run test-e2e-live` — Live production sites
- `npm run test-live-sites` — Selector validation against live sites

### Query validation

**`tests/test-queries.ts`** validates all SQL queries in the queries docs:

```bash
npm run test:queries
```

Requires `SUPABASE_URL`, `SUPABASE_TABLE`, and `SUPABASE_ACCESS_TOKEN` in `tests/.env`.

```bash
cd tests
npm run test-queries
```

Copy `tests/.env.example` to `tests/.env` and add the same Supabase credentials as the integration tests, plus a personal access token for the Management API:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your_secret_key
SUPABASE_TABLE=do11y_integration_test
SUPABASE_ACCESS_TOKEN=sbp_...
```

PostgREST doesn't support raw SQL. This test runs queries through the [Supabase Management API](https://supabase.com/docs/reference/api/v1-run-a-query) instead of a direct Postgres connection string.

Create `SUPABASE_ACCESS_TOKEN` at [Account tokens](https://supabase.com/dashboard/account/tokens), or run `supabase login` to store a token locally.

### Integration tests

**`tests/test-integrations.ts`** installs each supported framework, injects `do11y.js`, starts a local dev server, drives user interactions via Puppeteer, and then queries the Supabase database to verify that events arrived correctly.

#### Prerequisites

| Software | Required for | Notes |
|---|---|---|
| **Node.js** ≥18 | Test runner, build step, all npm-based frameworks | Uses `tsx` for TypeScript execution. |
| **npm** | Installing Node.js dependencies | Ships with Node.js. |
| **Python 3** + **pip** | MkDocs Material framework | Install with `pip install mkdocs-material`. |
| **Go** ≥1.12 | Docsy site (Hugo modules) | Docsy uses `github.com/google/docsy/theme` as a Hugo module via `go.mod`. Hugo delegates module resolution to Go. |
| **Chromium** | Puppeteer browser automation | Install with `npx puppeteer browsers install chrome`. |

#### Set up tests

```bash
cd tests
npm i
npx puppeteer browsers install chrome
```

Copy `tests/.env.example` to `tests/.env` and add your credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_secret_key
SUPABASE_TABLE=do11y_integration_test
```

Create a dedicated test table in the Supabase SQL Editor:

```sql
create table do11y_integration_test (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table do11y_integration_test enable row level security;

grant insert on do11y_integration_test to anon;
grant select on do11y_integration_test to service_role;

create policy "Allow anonymous inserts"
  on do11y_integration_test for insert
  to anon
  with check (true);
```

#### Run tests

Run the full suite:

```bash
npm run test-integrations
```

Run a subset of frameworks:

```bash
FRAMEWORKS=mintlify,vitepress npm run test-integrations
```

Skip dependency installation on repeat runs (uses already-installed `node_modules` in each site folder):

```bash
SKIP_INSTALL=1 npm run test-integrations
```

Skip the build step on repeat runs (uses existing `dist/do11y.js`):

```bash
SKIP_BUILD=1 npm run test-integrations
```

## Create release

1. Run all tests.

1. Bump the version in `package.json` and `src/core/constants.ts`.

1. Build and verify:

    ```bash
    npm run build
    npm run check
    npm run lint
    ```

1. Commit and push to `main`.

1. Tag and release:

    ```bash
    git tag v0.1.0
    git push origin v0.1.0
    gh release create v0.1.0
    ```

    Alternatively, create the release at [github.com/manototh/do11y/releases/new](https://github.com/manototh/do11y/releases/new).

1. Publish to npm:

    ```bash
    npm login
    npm publish --access public
    npm logout
    ```
