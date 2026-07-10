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

## Tests

The `tests` folder contains multiple layers of testing. Each catches a different class of failure:

| What broke | Which test catches it |
|---|---|
| Framework updated a CSS class name (selector drift) | `test-live-sites.ts` |
| Do11y broken on a specific framework's local dev server | `test-integrations.ts` |
| Events not reaching Supabase from a real production site | `test-e2e-live.ts` |

### Selector tests against live sites

**`tests/test-live-sites.ts`** runs headless Chromium via Puppeteer against real documentation sites to validate that selectors match elements in production. It requires no credentials. Its only job is to catch selector drift when a framework ships a DOM update that renames class names.

```bash
cd tests
npm i
npx puppeteer browsers install chrome
npm run test-live-sites
```

### E2E live-site tests

**`tests/test-e2e-live.ts`** is the only test that proves events reach Supabase from a real site. It injects `do11y.js` into live public documentation sites via Puppeteer's `evaluateOnNewDocument`, drives a realistic user journey, sends events to Supabase, and then queries the database to validate that the expected event types arrived.

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

Run the full suite:

```bash
npm run test-e2e-live
```

Run a subset of frameworks:

```bash
FRAMEWORKS=mintlify,vitepress npm run test-e2e-live
```

Skip the build step on repeat runs (uses an existing `dist/do11y.js`):

```bash
SKIP_BUILD=1 npm run test-e2e-live
```

### Query validation

**`tests/test-queries.ts`** validates that all SQL queries in the queries docs are syntactically correct by executing them against the Supabase database.

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

1. Bump the version in `package.json` and `src/do11y.ts`.

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
