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
| Instrumentation emits all 11 event types | Export tests (instrumentation-otel) | < 1s | None |
| Supabase export broken | Export smoke test | ~3s | `SUPABASE_*` |
| Built bundle emits all event types in real browser | Integration tests (fixture-based) | ~30s | None |
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
| `npm test` | All unit + selector + export + integration suites | None |
| `npm run test:unit` | Core + tracking + transport unit tests (321 tests) | None |
| `npm run test:selectors` | Framework selector fixture tests (70 tests) | None |
| `npm run test:export` | HTTP, OTLP, instrumentation-otel export tests | None |
| `npm run test:integration` | All 7 framework fixtures, Puppeteer, mock HTTP transport | None |
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

#### Instrumentation coverage

The `instrumentation-otel` export test (`tests/export/instrumentation-otel.test.ts`) validates that `DocsInstrumentation` emits all 11 event types through the OTel LoggerProvider API. Each event type is tested with representative DOM interactions:

| Event type | Unit test | Instr. export test | Standalone E2E |
|---|---|---|---|
| `page_view` | ✅ | ✅ | ✅ |
| `link_click` | ✅ | ✅ | ✅ |
| `scroll_depth` | ✅ | ✅ | ✅ |
| `search_opened` | ✅ | ✅ | ✅ |
| `code_copied` | ✅ | ✅ | ✅ |
| `expand_collapse` | ✅ | ✅ | ✅ |
| `toc_click` | ✅ | ✅ | ✅ |
| `feedback` | ✅ | ✅ | ✅ |
| `page_exit` | ✅ | ✅ | ✅ |
| `section_visible` | ✅ | ✅ | — |
| `tab_switch` | ✅ | ✅ | — |

`section_visible` and `tab_switch` are not tested in the Puppeteer-based standalone E2E because they require `IntersectionObserver` and specific DOM structures that are hard to trigger reliably across all 7 framework fixtures. Unit tests and the instrumentation export test cover them.

### Supabase smoke test (optional)

Requires `SUPABASE_URL` and `SUPABASE_KEY` in `tests/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=sb_publishable_your_key
```

```bash
npm run test:supabase
```

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

### Integration tests (no credentials)

**`tests/integration/standalone.test.ts`** loads the built `dist/do11y.js` in Puppeteer against representative HTML fixtures for all 7 supported frameworks. It drives the full interaction sequence (TOC click, scroll, search, code copy, expand/collapse, feedback, link navigation, page exit) and validates that all expected event types are emitted via the HTTP transport to a local mock server.

This replaces the legacy `test-integrations.ts` and `test-e2e-live.ts` runners which required Supabase credentials, framework-specific dev servers, and Python/Go/Hugo toolchains. The vitest version needs only Chromium:

```bash
npx puppeteer browsers install chrome
npm run test:integration
```

The fixture HTML files in `tests/integration/fixtures/` mimic each framework's DOM structure. The **selector snapshot tests** (`tests/selector-snapshots/`) independently verify that the CSS selector presets match real framework DOMs — both against static fixtures (fast, in CI) and live production URLs (gated on `TEST_LIVE=1`).

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
