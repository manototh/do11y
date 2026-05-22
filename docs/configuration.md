---
title: Configuration
description: All Do11y configuration options, including destination, behavior, framework, and custom selectors.
head:
  - - meta
    - property: og:title
      content: Configuration — Do11y
  - - meta
    - property: og:description
      content: All Do11y configuration options, including destination, behavior, framework, and custom selectors.
---

# Configuration

Set all options via `window.Do11yConfig` using an inline script or a separate config file, or via meta tags. When both are present, meta tags take precedence over `window.Do11yConfig`, which takes precedence over the defaults.

## Destination

Do11y supports two destinations for event data: Tinybird (default) and generic HTTP.

| Option | Default | Description |
|---|---|---|
| `destination` | `'tinybird'` | Where to send events. `'tinybird'` or `'http'`. |

### Tinybird

| Option | Default | Description |
|---|---|---|
| `tinybirdHost` | `'api.tinybird.co'` | Tinybird API host. Use `'api.eu-central-1.aws.tinybird.co'` for EU. |
| `tinybirdToken` | `''` | Token with `DATASOURCE:APPEND` scope. |
| `tinybirdDatasource` | `'do11y'` | Name of the Tinybird datasource. |

### HTTP

Send events to any HTTPS endpoint. Useful for custom backends, webhook relays, or other analytics platforms.

| Option | Default | Description |
|---|---|---|
| `httpEndpoint` | `''` | Full URL to POST events to. Must be HTTPS. |
| `httpHeaders` | `{}` | Custom headers to include (e.g. authorization). |

When using HTTP, events are sent as a JSON array in the POST body. The `Content-Type: application/json` header is set automatically.

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
| `allowedDomains` | `null` | Restrict which domains may send data. Set to `null` to allow any. |
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
| `'custom'` | Provide your own selectors (see below) |

When you set `framework` to a supported value, Do11y automatically configures the correct CSS selectors for search bars, copy buttons, code blocks, navigation, footers, and content areas.

You can also set the framework via a meta tag:

```html
<meta name="do11y-framework" content="docusaurus">
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
  tinybirdHost: 'api.tinybird.co',
  tinybirdToken: 'p.your-ingest-token',
  tinybirdDatasource: 'do11y',
  framework: 'custom',
  searchSelector: '#search-input',
  copyButtonSelector: '.copy-btn',
  codeBlockSelector: 'pre code',
  contentSelector: 'article.content',
  tocSelector: 'nav.toc',
  feedbackSelector: null,
};
```
