---
title: Configuration
description: All Do11y configuration options, including Axiom connection, behavior, framework, and custom selectors.
head:
  - - meta
    - property: og:title
      content: Configuration — Do11y
  - - meta
    - property: og:description
      content: All Do11y configuration options, including Axiom connection, behavior, framework, and custom selectors.
---

# Configuration

Set all options via `window.Do11yConfig` using an inline script or a separate config file, or via meta tags. When both are present, meta tags take precedence over `window.Do11yConfig`, which takes precedence over the defaults.

## Axiom connection

| Option | Default | Description |
|---|---|---|
| `axiomHost` | `'AXIOM_DOMAIN'` | Base domain of your Axiom edge deployment. See [Edge deployments](https://axiom.co/docs/reference/edge-deployments). |
| `axiomDataset` | `'DATASET_NAME'` | Name of the Axiom dataset to store your data. |
| `axiomToken` | `'API_TOKEN'` | Ingest-only API token scoped to the dataset. |

## Behavior

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
| `retryDelay` | `1000` | Base delay between retries in milliseconds (doubles each attempt). |
| `rateLimitMs` | `100` | Minimum gap between events of the same type. |

## Framework

Set `framework` to auto-configure CSS selectors for your documentation platform:

| Value | Framework |
|---|---|
| `'mintlify'` | [Mintlify](https://mintlify.com) (default) |
| `'docusaurus'` | [Docusaurus](https://docusaurus.io) |
| `'nextra'` | [Nextra](https://nextra.site) |
| `'mkdocs-material'` | [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) |
| `'vitepress'` | [VitePress](https://vitepress.dev) |
| `'starlight'` | [Starlight](https://starlight.astro.build) (Astro) |
| `'custom'` | Provide your own selectors (see below) |

When you set `framework` to a supported value, Do11y automatically configures the correct CSS selectors for search bars, copy buttons, code blocks, navigation, footers, and content areas.

You can also set the framework via a meta tag:

```html
<meta name="axiom-do11y-framework" content="docusaurus">
```

## Custom selectors

Set `framework: 'custom'` and provide any combination of the selectors below. Any selector left `null` falls back to the Mintlify default.

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

Example:

```js
window.Do11yConfig = {
  axiomHost: 'us-east-1.aws.edge.axiom.co',
  axiomToken: 'xaat-your-ingest-token',
  axiomDataset: 'do11y',
  framework: 'custom',
  searchSelector: '#search-input',
  copyButtonSelector: '.copy-btn',
  codeBlockSelector: 'pre code',
  contentSelector: 'article.content',
  tocSelector: 'nav.toc',
  feedbackSelector: null,
};
```
