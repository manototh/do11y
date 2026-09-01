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

Copy `tests/.env.example` to `tests/.env` and add your test Supabase credentials. Create `SUPABASE_ACCESS_TOKEN` at [Account tokens](https://supabase.com/dashboard/account/tokens), or run `supabase login` to store a token locally.

All tests use **Vitest**. Run them from the `tests/` directory:

```bash
cd tests
npm i
npx puppeteer browsers install chrome
npm test
```

### Test suites

| Command | What runs | Credentials |
|---|---|---|
| `npm test` | All unit + selector + export + integration suites | None |
| `npm run test:unit` | Core + tracking + transport unit tests | None |
| `npm run test:selectors` | Framework selector fixture tests | None |
| `npm run test:export` | HTTP, OTLP, instrumentation-otel export tests | None |
| `npm run test:integration` | All framework fixtures, Puppeteer, mock HTTP transport | None |
| `npm run test:supabase` | Supabase smoke test | `SUPABASE_URL`, `SUPABASE_KEY` |
| `npm run test:live-selectors` | Live-site CSS drift check | None (but network) |
| `npm run test:all` | All suites, verbose output | Varies |

### Instrumentation coverage

Each event type is tested with representative DOM interactions:

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

`section_visible` and `tab_switch` are not tested in the Puppeteer-based standalone E2E because they require `IntersectionObserver` and specific DOM structures that are hard to trigger reliably across all framework fixtures. Unit tests and the instrumentation export test cover them.

## Create release

1. Bump the version in `package.json` and `src/core/constants.ts`.

1. Build, verify, and run tests:

    ```bash
    npm run all
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
