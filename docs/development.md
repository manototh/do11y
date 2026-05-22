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
| Events not reaching Axiom from a real production site | `test-e2e-live.ts` |

### Selector tests against live sites

**`tests/test-live-sites.ts`** runs headless Chromium via Puppeteer against real documentation sites to validate that selectors match elements in production. It requires no Axiom credentials. Its only job is to catch selector drift when a framework ships a DOM update that renames class names.

```bash
cd tests
npm i
npx puppeteer browsers install chrome
npm run test-live-sites
```

Sites covered:

| Framework | URL |
|---|---|
| Mintlify | https://www.mintlify.com/docs/components/expandables |
| Docusaurus | https://docusaurus.io/docs/next/swizzling |
| Nextra | https://nextra.site/docs/docs-theme/start |
| MkDocs Material | https://squidfunk.github.io/mkdocs-material/reference/admonitions |
| VitePress | https://vitepress.dev/guide/markdown |

### E2E live-site tests

**`tests/test-e2e-live.ts`** is the only test that proves events reach Axiom from a real site. It injects `do11y.js` into live public documentation sites via Puppeteer's `evaluateOnNewDocument`, drives a realistic user journey, sends events to Axiom, and then queries Axiom to validate that the expected event types arrived.

```bash
cd tests
npm i
npx puppeteer browsers install chrome
```

Copy `tests/.env.example` to `tests/.env` and add your credentials:

```
AXIOM_DOMAIN=us-east-1.aws.edge.axiom.co
AXIOM_TOKEN=xaat-your-ingest-token
AXIOM_DATASET=do11y
```

The token requires both **ingest** and **query** permissions on the target dataset.

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

Sites covered:

| Framework | Start URL | Second URL |
|---|---|---|
| Mintlify | https://www.mintlify.com/docs/components/expandables | https://www.mintlify.com/docs/components/accordions |
| Docusaurus | https://docusaurus.io/docs/next/swizzling | https://docusaurus.io/docs/next/markdown-features |
| Nextra | https://nextra.site/docs/docs-theme/start | https://nextra.site/docs/docs-theme/built-ins/layout |
| MkDocs Material | https://squidfunk.github.io/mkdocs-material/reference/admonitions | https://squidfunk.github.io/mkdocs-material/reference/code-blocks/ |
| VitePress | https://vitepress.dev/guide/getting-started | https://vitepress.dev/guide/markdown |

Events validated per framework:

| Event | Minimum expected | Notes |
|---|---|---|
| `page_view` | 2 | Start page + second page |
| `scroll_depth` | 1 | |
| `link_click` | 1 | |
| `page_exit` | 1 | |
| `expand_collapse` | 1 | 0 for Nextra (no documentation-level expandables on test page) |
| `toc_click` | 1 | |
| `search_opened` | 0 | Best-effort. Not all frameworks render search the same way. |
| `code_copied` | 1 | |
| `feedback` | 0 | 1 for Mintlify and MkDocs Material |
| `section_visible` | 1 | `sectionVisibleThreshold: 1` + 2s dwell |

### Query validation

**`tests/test-queries.ts`** validates that all APL queries in `QUERIES.md` are syntactically correct by executing them against the Axiom API.

```bash
cd tests
npm run test-queries
```

### Integration tests

**`tests/test-integrations.ts`** installs each supported framework, injects `do11y.js`, starts a local dev server, drives user interactions via Puppeteer, and then queries the Axiom API to verify that events arrived correctly.

```bash
cd tests
npm i
npx puppeteer browsers install chrome
```

Copy `tests/.env.example` to `tests/.env` and add your credentials:

```
AXIOM_DOMAIN=us-east-1.aws.edge.axiom.co
AXIOM_TOKEN=xaat-your-ingest-token
AXIOM_DATASET=do11y
```

Run the full suite:

```bash
npm run test-integrations
```

Run a subset of frameworks:

```bash
FRAMEWORKS=mintlify,vitepress npm run test-integrations
```

Skip dependency installation on repeat runs:

```bash
SKIP_INSTALL=1 npm run test-integrations
```

Frameworks covered:

| Name | Type | Port | Notes |
|---|---|---|---|
| `mintlify` | npm (Mintlify CLI) | 4005 | Full framework install |
| `docusaurus` | npm (Docusaurus 3) | 4001 | Full framework install |
| `nextra` | npm (Next.js + Nextra 3) | 4002 | Full framework install |
| `vitepress` | npm (VitePress 1.x) | 4003 | Full framework install |
| `mkdocs-material` | pip (MkDocs Material) | 4004 | Requires Python. Skips if unavailable. |

## Create a release

1. Run all tests.

2. Bump the version in `package.json` and `src/do11y.ts`.

3. Build and verify:

```bash
npm run build
npm run check
npm run lint
```

4. Commit and push to `main`.

5. Tag and release:

```bash
git tag v1.1.0
git push origin v1.1.0
gh release create v1.1.0
```

Alternatively, create the release at [github.com/axiomhq/do11y/releases/new](https://github.com/axiomhq/do11y/releases/new).

6. Publish to npm as `@axiomhq/do11y` (requires access to the `@axiomhq` npm organization):

```bash
npm login
npm publish --access public
npm logout
```
