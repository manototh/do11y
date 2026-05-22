# Axiom Do11y

Do11y is a documentation observability solution from [Axiom](https://axiom.co). It turns documentation usage into machine data. It streams behavioral events like the ones below from your docs site to Axiom in real time:

- Page views
- Scroll depth
- Link clicks
- Search queries
- Code-block copies
- Section reading time
- Tab switches
- Table of contents (TOC) usage
- Feedback widget usage
- Expand/collapse interactions

Do11y is built for humans and machines alike. It emits observability data designed to be easy to use for human users, while also being easy to query and analyze for machines.

Do11y is agent-native: in an era where AI assistants and autonomous agents increasingly read and cite documentation alongside human users, Do11y detects AI platform referrers (ChatGPT, Perplexity, Claude, Gemini, and others) so you can understand how agents and humans engage with your content differently.

The runtime artifact is a single dependency-free JavaScript file. The source is TypeScript (`src/do11y.ts`). [rolldown](https://rolldown.rs) produces the built output.

## Privacy

Do11y collects anonymous usage data:

- No cookies. Do11y uses `sessionStorage`, which the browser clears when it closes.
- No personal identifiable information (PII).
- No device fingerprinting.
- No cross-site tracking.

You don't need a GDPR consent banner for using Do11y.

## Supported frameworks

Do11y supports the latest versions of the following frameworks:

- Mintlify
- Docusaurus
- Nextra
- MkDocs Material
- VitePress

For other frameworks, use [manual setup](#manual-setup).

## Prerequisites

1. [Create an Axiom account](https://app.axiom.co/register).
1. [Create a dataset in Axiom](https://axiom.co/docs/reference/datasets#create-dataset) to store observability data for your documentation site.
1. [Create an API token in Axiom](https://axiom.co/docs/reference/tokens) with **ingest-only** permissions scoped to the dataset.

## Quickstart

### Mintlify

1. Download the latest release from [GitHub](https://github.com/axiomhq/do11y/releases/latest) and extract the `do11y-<version>.zip` file.
1. Copy `dist/do11y.min.js` and `examples/do11y-config.example.js` to the same folder in your documentation project (for example, `scripts/`). Alphabetical ordering ensures the config loads first.
1. Rename `do11y-config.example.js` to `do11y-config.js`.
1. In `do11y-config.js`, replace the placeholder values with your Axiom credentials.

    ```js
    window.Do11yConfig = {
    axiomHost: 'AXIOM_DOMAIN',
    axiomToken: 'API_TOKEN',
    axiomDataset: 'DATASET_NAME',
    framework: 'mintlify',
    };
    ```

1. Optional: Set up the [automatic sync to your docs repo](#automatic-sync-to-your-docs-repo) to keep your copy of `do11y.min.js` up to date.

### Docusaurus

Add the following to the `headTags` and `scripts` fields in `docusaurus.config.js` if you use JavaScript, or `docusaurus.config.ts` if you use TypeScript:

```js
headTags: [
    { tagName: 'meta', attributes: { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' } },
    { tagName: 'meta', attributes: { name: 'axiom-do11y-token', content: 'API_TOKEN' } },
    { tagName: 'meta', attributes: { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' } },
    { tagName: 'meta', attributes: { name: 'axiom-do11y-framework', content: 'docusaurus' } },
],
scripts: [{ src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js', defer: true }],
```

### Nextra

Add the following to the `<Head>` component in `pages/_app.jsx` (or `_app.tsx`) if you use the Pages Router, or `app/layout.jsx` (or `app/layout.tsx`) if you use the App Router:

```jsx
<Head>
    <meta name="axiom-do11y-domain" content="AXIOM_DOMAIN" />
    <meta name="axiom-do11y-token" content="API_TOKEN" />
    <meta name="axiom-do11y-dataset" content="DATASET_NAME" />
    <meta name="axiom-do11y-framework" content="nextra" />
    <script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

### VitePress

Add the following to the `head` field in `.vitepress/config.js` (or `.vitepress/config.ts`):

```js
head: [
    ['meta', { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' }],
    ['meta', { name: 'axiom-do11y-token', content: 'API_TOKEN' }],
    ['meta', { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' }],
    ['meta', { name: 'axiom-do11y-framework', content: 'vitepress' }],
    ['script', { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js' }],
],
```

### MkDocs Material

Add the following to `mkdocs.yml`:

```yaml
theme:
  name: material
  custom_dir: overrides
extra_javascript:
  - https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js
```

Create `overrides/main.html` to inject the meta tags:

```html
{% extends "base.html" %}
{% block extrahead %}
  <meta name="axiom-do11y-domain" content="AXIOM_DOMAIN">
  <meta name="axiom-do11y-token" content="API_TOKEN">
  <meta name="axiom-do11y-dataset" content="DATASET_NAME">
  <meta name="axiom-do11y-framework" content="mkdocs-material">
{% endblock %}
```

See the [MkDocs Material docs](https://squidfunk.github.io/mkdocs-material/customization/#extending-the-theme) for details on custom theme overrides.

## Query data

Once you've installed Do11y and information about your documentation usage is flowing into Axiom, you can query the data in Axiom. See [QUERIES.md](QUERIES.md) for exampleAPL queries to analyze your documentation, including:

- AI traffic detection and trends
- Traffic sources and entry points
- Page engagement and scroll completion
- Where users get stuck (exit pages, low engagement)
- Navigation patterns and user journeys
- Link and CTA performance
- Code block engagement

For more information, see [Query data with Axiom](https://axiom.co/docs/query-data/explore).

## Integration dashboard

An integration dashboard provides a visual overview of your documentation usage. It shows important metrics like the number of page views, scroll depth, link clicks, code-block copies, section reading time, tab switches, TOC usage, feedback widget usage, and expand/collapse interactions. It's automatically created when you add Do11y to your docs site.

To access the integration dashboard:
1. In Axiom, click **Dashboards**.
1. In the **Integrations** section, click the integration dashboard **Documentation observability (Do11y) (DATASET_NAME)**.

Alternatively, access the integration dashboard with the URL `https://app.axiom.co/ORG_ID/dashboards/do11y.DATASET_NAME`.

## AI traffic detection

Do11y classifies referrer domains to detect traffic from AI platforms such as ChatGPT, Perplexity, Claude, Gemini, Copilot, DeepSeek, and others. Each `page_view` event includes:

| Field | Values | Description |
|---|---|---|
| `referrerCategory` | `ai`, `search-engine`, `social`, `community`, `code-host`, `direct`, `internal`, `other`, `unknown` | High-level traffic source category. |
| `aiPlatform` | `ChatGPT`, `Perplexity`, `Claude`, `Gemini`, `Copilot`, `DeepSeek`, `Meta AI`, `Grok`, `Mistral`, `You.com`, `Phind`, or `null` | Specific AI platform when `referrerCategory` is `ai`. |

This detection is referrer-based: it checks whether the `document.referrer` hostname matches a known AI platform. Do11y uses no fingerprinting, user-agent parsing, or additional data collection.

**Limitation:** Most AI platforms (especially ChatGPT mobile and API-sourced visits) don't pass referrer headers. These visits appear as `direct` traffic. Referrer-based detection typically captures 20-40% of AI traffic. Detecting the remaining "dark AI" traffic would require fingerprinting techniques that conflict with Do11y's privacy-first design.

See [QUERIES.md](QUERIES.md) for APL queries to analyze AI traffic, including per-platform breakdowns, trends, and engagement comparisons.

## Known limitations

### Custom themes

The selectors work on sites using the standard themes of each supported framework. Sites with heavily customized themes may render page elements differently. If you use a custom theme, check whether you need to set the selectors manually.

### Framework selector drift

CSS selectors reflect each framework's current DOM output and may break when frameworks release major updates that change class names or HTML structure. The test suites (`test-live-sites.ts`, `test-e2e-live.ts`, and `test-queries.ts`) exist specifically to catch this. Run them periodically to verify selectors still match.

## Manual setup

### Option 1: CDN (recommended)

Add the script to every page of your docs site. The simplest setup uses meta tags for the required settings:

```html
<meta name="axiom-do11y-domain" content="AXIOM_DOMAIN">
<meta name="axiom-do11y-token" content="API_TOKEN">
<meta name="axiom-do11y-dataset" content="DATASET_NAME">
<meta name="axiom-do11y-framework" content="FRAMEWORK">
<script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js"></script>
```

Replace the meta tag values with your Axiom credentials and docs framework. To pin a specific version, replace `latest` with a version tag like `1.0.0`.

#### Advanced configuration via CDN

Meta tags only cover the essential settings. To configure any of the [advanced options](#configuration) such as scroll thresholds, tracking toggles, or custom selectors, set `window.Do11yConfig` in an inline script placed **before** the CDN script tag:

```html
<script>
window.Do11yConfig = {
  axiomHost: 'us-east-1.aws.edge.axiom.co',
  axiomToken: 'xaat-your-ingest-token',
  axiomDataset: 'do11y',
  framework: 'vitepress',
  scrollThresholds: [25, 50, 75, 100],
  trackFeedback: false,
  sectionVisibleThreshold: 5,
  // Any option from the Configuration table below can be set here
};
</script>
<script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js"></script>
```

When both are present, meta tags take precedence over `window.Do11yConfig`, which takes precedence over the defaults.

### Option 2: Self-host

If you can't use a CDN, self-host the script.

1. Download the latest release from [GitHub](https://github.com/axiomhq/do11y/releases/latest) and extract the `do11y-<version>.zip` file.
1. Copy `dist/do11y.min.js` and `examples/do11y-config.example.js` to your documentation project (for example, `scripts/`).
1. Rename `do11y-config.example.js` to `do11y-config.js`.
1. In `do11y-config.js`, replace the placeholder values with your Axiom credentials.

    ```js
    window.Do11yConfig = {
    axiomHost: 'AXIOM_DOMAIN',
    axiomToken: 'API_TOKEN',
    axiomDataset: 'DATASET_NAME',
    framework: 'FRAMEWORK',
    };
    ```

1. Add both scripts to every page, with the config file loading first:

    ```html
    <script src="/path/to/do11y-config.js"></script>
    <script src="/path/to/do11y.min.js"></script>
    ```

1. Optional: Set up the [automatic sync to your docs repo](#automatic-sync-to-your-docs-repo) to keep your copy of `do11y.min.js` up to date.

Don't edit `do11y.min.js` directly. It's a build artifact and updating to a new release overwrites it.

#### Automatic sync to your docs repo

If you self-host `do11y.min.js` in GitHub repo, the included GitHub Action (`examples/sync-do11y-to-docs.yml`) keeps your copy up to date automatically.

1. Copy `examples/sync-do11y-to-docs.yml` to `.github/workflows/` in your docs repo. It runs every Monday and opens a PR whenever a new do11y release is available.
1. Create an empty file at `do11y.version`. This file is used to track the version of `do11y.min.js`.
1. Add the following repository variables in your docs repo under **Settings > Secrets and variables > Actions > Variables > New repository variable**:

    | Variable | Example | Description |
    |---|---|---|
    | `DO11Y_JS_PATH` | `scripts/do11y.min.js` | Path to `do11y.min.js` in your docs repo. |
    | `DO11Y_VER_PATH` | `scripts/do11y.version` | Path to a version tracking file in your docs repo. |

1. Ensure the GitHub Action has permission to push to your docs repo. Go to **Settings > Actions > General > Workflow permissions**, and turn on **Allow GitHub Actions to create and approve pull requests**.

You don't need to add any secrets.

## Configuration

All options can be set via `window.Do11yConfig` (inline script or a separate config file) or via meta tags.

### Axiom connection

| Option | Default | Description |
|---|---|---|
| `axiomHost` | `'AXIOM_DOMAIN'` | Base domain of the edge deployment where you want to store your data. For more information, see [Edge deployments](https://axiom.co/docs/reference/edge-deployments). |
| `axiomDataset` | `'DATASET_NAME'` | Name of the Axiom dataset where you want to store your data. |
| `axiomToken` | `'API_TOKEN'` | Ingest-only API token scoped to the dataset. |

### Behavior

| Option | Default | Description |
|---|---|---|
| `debug` | `false` | Log events to the browser console. |
| `flushInterval` | `5000` | Milliseconds between batch flushes. |
| `maxBatchSize` | `10` | Events queued before forcing a flush. |
| `trackOutboundLinks` | `true` | Track clicks on external links. |
| `trackInternalLinks` | `true` | Track clicks on internal links. |
| `trackScrollDepth` | `true` | Track scroll depth thresholds. |
| `scrollThresholds` | `[25, 50, 75, 90]` | Scroll percentages to record. |
| `trackSectionVisibility` | `true` | Track which headings users actually read (via IntersectionObserver). |
| `sectionVisibleThreshold` | `3` | Minimum seconds a section must be visible before recording. |
| `trackTabSwitches` | `true` | Track code language/framework tab switches. |
| `trackTocClicks` | `true` | Track on-page table of contents clicks. |
| `trackExpandCollapse` | `true` | Track expand/collapse interactions (details, accordions). |
| `trackFeedback` | `true` | Track "Was this helpful?" feedback widget clicks. |
| `allowedDomains` | `['ALLOWED_DOMAINS']` | Restrict which domains may send data. Set to `null` to allow any. |
| `respectDNT` | `true` | Honor the browser's Do Not Track setting. |
| `maxRetries` | `2` | Retry count for failed requests. |
| `retryDelay` | `1000` | Base delay between retries (doubles each attempt). |
| `rateLimitMs` | `100` | Minimum gap between events of the same type. |

### Documentation framework

Set `framework` to auto-configure CSS selectors for your docs platform:

| Value | Framework |
|---|---|
| `'mintlify'` | [Mintlify](https://mintlify.com) (default) |
| `'docusaurus'` | [Docusaurus](https://docusaurus.io) |
| `'nextra'` | [Nextra](https://nextra.site) |
| `'mkdocs-material'` | [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) |
| `'vitepress'` | [VitePress](https://vitepress.dev) |
| `'custom'` | Provide your own selectors (see below) |

When `framework` is set to a supported value, the script automatically uses the correct CSS selectors for search bars, copy buttons, code blocks, navigation, footers, and content areas. Optional: Set the framework via a meta tag:

```html
<meta name="axiom-do11y-framework" content="docusaurus">
```

### Custom selectors

Set `framework: 'custom'` and provide any combination of these selectors. Any selector left `null` falls back to the Mintlify default.

| Selector | What it targets |
|---|---|
| `searchSelector` | Search trigger elements (input, button). |
| `copyButtonSelector` | "Copy code" buttons inside code blocks. |
| `codeBlockSelector` | Code block containers (`<pre>`, wrappers). |
| `navigationSelector` | Navigation and sidebar regions. |
| `footerSelector` | Page footer. |
| `contentSelector` | Main content area. |
| `tabContainerSelector` | Tab groups for code language/framework switching. |
| `tocSelector` | On-page table of contents container. |
| `feedbackSelector` | "Was this helpful?" feedback widget container. |

## Events collected

| Event | Description | Key fields |
|---|---|---|
| `page_view` | Fires on every page load or SPA navigation. | `referrerDomain`, `referrerCategory`, `aiPlatform`, `isFirstPage`, `previousPath` |
| `link_click` | Internal, external, anchor, or email link click. | `linkType`, `targetUrl`, `linkText`, `linkContext`, `linkSection`, `linkIndex` |
| `scroll_depth` | User scrolls past a configured threshold. | `threshold`, `scrollPercent` |
| `page_exit` | Fires on `beforeunload`. | `totalTimeSeconds`, `activeTimeSeconds`, `engagementRatio`, `maxScrollDepth`, `referrerCategory`, `aiPlatform` |
| `search_opened` | User opens the search dialog (click or Cmd/Ctrl+K). | `trigger` |
| `code_copied` | User clicks a code block's copy button. | `language`, `codeSection`, `codeBlockIndex` |
| `section_visible` | A heading stayed visible in the viewport long enough for the user to read it. | `heading`, `headingLevel`, `visibleSeconds` |
| `tab_switch` | User switches a code language/framework tab. | `tabLabel`, `tabGroup`, `isDefault` |
| `toc_click` | User clicks an entry in the on-page table of contents. | `heading`, `headingLevel`, `tocPosition` |
| `feedback` | User clicks a "Was this helpful?" button. | `rating` |
| `expand_collapse` | User toggles a `<details>` element or accordion. | `summary`, `action`, `section` |

Every event also includes: `sessionId`, `sessionPageCount`, `path`, `hash`, `title`, `viewportCategory`, `browserFamily`, `deviceType`, `language`, and `timezoneOffset`.

## JavaScript API

Do11y exposes `window.AxiomDo11y` for debugging and integration:

```javascript
AxiomDo11y.getConfig()    // Current config (token redacted)
AxiomDo11y.isEnabled()    // Whether tracking is active
AxiomDo11y.flush()        // Force-send queued events
AxiomDo11y.getQueueSize() // Number of queued events
AxiomDo11y.version        // Script version
```

Do11y doesn't expose `cleanup()` and `debug()` on the global object. Exposing `cleanup()` would allow any third-party script on the page to silently stop tracking. Exposing `debug()` would allow any script to enable verbose console output that reveals the configured ingest endpoint and queued event data.

## Tests

The `tests` folder contains multiple layers of testing. Each catches a different class of failure:

| What broke | Which test catches it |
|---|---|
| Framework updated a CSS class name (selector drift) | `test-live-sites.ts` |
| do11y broken on a specific framework's local dev server | `test-integrations.ts` |
| Events not reaching Axiom from a real production site | `test-live-e2e.ts` |

**`test-live-sites.ts`** checks that CSS selectors match real DOM elements in production. It requires no Axiom credentials and no event ingestion — its only job is to catch selector drift when a framework ships a DOM update that renames class names.

**`test-integrations.ts`** runs against local scaffolded sites where the page content is fully under your control. Every interaction is guaranteed to fire: the guide page includes a `<details>` block, a TOC, a code block with a copy button, and a feedback widget. This is why it can assert hard minimums (`code_copied: 1`, `expand_collapse: 1`, `toc_click: 1`) that the live E2E test cannot. It also validates that do11y works correctly with each framework's dev server, SPA routing model, and build toolchain in a hermetic environment.

**`test-live-e2e.ts`** is the only test that proves events reach Axiom from a real site. It catches issues that only surface in production: CDN caching, CSP headers, third-party script interference, or a site's own JavaScript conflicting with do11y.

### Selector tests against live sites (`tests/test-live-sites.ts`)

Runs headless Chromium via Puppeteer against real documentation sites to validate that selectors match elements in production.

```bash
cd tests
npm i
npx puppeteer browsers install chrome
npm run test-live-sites
```

The test covers the following sites:

| Framework | URL |
|---|---|
| Mintlify | https://www.mintlify.com/docs/components/expandables |
| Docusaurus | https://docusaurus.io/docs/next/swizzling |
| Nextra | https://nextra.site/docs/docs-theme/start |
| MkDocs Material | https://squidfunk.github.io/mkdocs-material/reference/admonitions |
| VitePress | https://vitepress.dev/guide/markdown |

### E2E live-site tests (`tests/test-e2e-live.ts`)

End-to-end tests that inject `do11y.js` into the same live public documentation sites as `test-live-sites.ts` via Puppeteer's `evaluateOnNewDocument`, drive a realistic user journey on each site, send events to Axiom, and then query Axiom to validate that the expected event types arrived. No local dev servers are required.

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

The test covers the same sites as `test-live-sites.ts`:

| Framework | Start URL | Second URL |
|---|---|---|
| Mintlify | https://www.mintlify.com/docs/components/expandables | https://www.mintlify.com/docs/components/accordions |
| Docusaurus | https://docusaurus.io/docs/next/swizzling | https://docusaurus.io/docs/next/markdown-features |
| Nextra | https://nextra.site/docs/docs-theme/start | https://nextra.site/docs/docs-theme/built-ins/layout |
| MkDocs Material | https://squidfunk.github.io/mkdocs-material/reference/admonitions | https://squidfunk.github.io/mkdocs-material/reference/code-blocks/ |
| VitePress | https://vitepress.dev/guide/getting-started | https://vitepress.dev/guide/markdown |

The test validates the following events per framework:

| Event | Minimum expected | Notes |
|---|---|---|
| `page_view` | 2 | Start page + second page |
| `scroll_depth` | 1 | |
| `link_click` | 1 | |
| `page_exit` | 1 | |
| `expand_collapse` | 1 | 0 for Nextra (no documentation-level expandables on test page) |
| `toc_click` | 1 | |
| `search_opened` | 0 | Best-effort — not all frameworks render search the same way |
| `code_copied` | 1 | |
| `feedback` | 0 | 1 for Mintlify and MkDocs Material (confirmed widget on test pages) |
| `section_visible` | 1 | `sectionVisibleThreshold: 1` + 2 s dwell on page load |

### Query validation (`tests/test-queries.ts`)

Validates that all APL queries in [QUERIES.md](QUERIES.md) are syntactically correct by executing them against the Axiom API.

```bash
cd tests
npm run test-queries
```

### Integration tests (`tests/test-integrations.ts`)

End-to-end tests that install each supported framework, inject `do11y.js`, start a local dev server, drive user interactions via Puppeteer, and then query the Axiom API to verify that events arrived correctly.

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

The test covers the following frameworks:

| Name | Type | Port | Notes |
|---|---|---|---|
| `mintlify` | npm (Mintlify CLI) | 4005 | Full framework install |
| `docusaurus` | npm (Docusaurus 3) | 4001 | Full framework install |
| `nextra` | npm (Next.js + Nextra 3) | 4002 | Full framework install |
| `vitepress` | npm (VitePress 1.x) | 4003 | Full framework install |
| `mkdocs-material` | pip (MkDocs Material) | 4004 | Requires Python. Skips if unavailable. |

The test validates the following events per framework:

| Event | Minimum expected | Notes |
|---|---|---|
| `page_view` | 2 | Start page + guide page |
| `scroll_depth` | 1 | |
| `link_click` | 1 | |
| `page_exit` | 1 | |
| `expand_collapse` | 1 | |
| `toc_click` | 1 | |
| `search_opened` | 0 | |
| `code_copied` | 1 | |
| `feedback` | 0 | |
| `section_visible` | 1 | `sectionVisibleThreshold: 1` + 2 s dwell on page load |

## Create release

1. Run all [tests](#tests).
1. Bump the version in `package.json` and `src/do11y.ts`.
1. Run the following commands to build the package and run the tests:

    ```bash
    npm run build
    npm run check
    npm run lint
    ```

1. Commit the changes and push to the `main` branch.
1. Tag and release via the GitHub CLI:

    ```bash
    git tag v1.1.0
    git push origin v1.1.0
    gh release create v1.1.0
    ```

    Alternatively, use the GitHub UI to create a release at https://github.com/axiomhq/do11y/releases/new

1. Publish the package to npm as `@axiomhq/do11y`. This requires access to the `@axiomhq` npm organization.

    ```bash
    npm login
    npm publish --access public
    npm logout
    ```

## License

[MIT](LICENSE)
