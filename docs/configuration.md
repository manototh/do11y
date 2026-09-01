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

This page documents all configuration options for Do11y except for destination options. See [Destinations and setup paths](/destinations) for more information on destinations.

## Set options

The way you set options for Do11y depends on which setup path you use:

- [Standalone path](#standalone-path)
- [OpenTelemetry instrumentation path](#opentelemetry-instrumentation-path)

### Standalone path

Set options using one of the following methods:

| | Meta tags | Configuration object |
|---|---|---|
| Scope | Limited set of options | All options |
| Value types | Strings only | Native JavaScript types |
| Precedence | Read last, takes precedence over configuration object | Read first, overridden by a matching meta tag |

#### Meta tags

Create meta tags using the form `<meta name="do11y-..." content="..." />`.

The following options are supported:

| Meta tag `name` | Config option |
|---|---|
| `do11y-destination` | `destination` |
| `do11y-url` | `supabaseUrl` |
| `do11y-key` | `supabaseKey` |
| `do11y-table` | `supabaseTable` |
| `do11y-endpoint` | `endpoint` |
| `do11y-otlp-endpoint` | `otelSdkEndpoint` |
| `do11y-otlp-headers` | `otelSdkHeaders` |
| `do11y-debug` | `debug` |
| `do11y-domains` | `allowedDomains` |
| `do11y-framework` | `framework` |
| `do11y-use-otel-instrumentations` | `useOtelBrowserInstrumentations` |

#### Configuration object

Create a `window.Do11yConfig` object from an inline script or a separate config file. For example:

```js
window.Do11yConfig = {
  destination: 'http',
  endpoint: 'BACKEND_URL',
  headers: {
    'Authorization': 'Bearer API_TOKEN',
  },
  framework: 'vitepress',
  scrollThresholds: [25, 50, 75, 95],
  respectDNT: false,
};
```

## OpenTelemetry instrumentation path

Pass configuration as a constructor argument to `DocsInstrumentation`:

```ts
import { DocsInstrumentation } from '@manototh/do11y/instrumentation';

new DocsInstrumentation({
  framework: 'vitepress',
  trackScrollDepth: true,
  trackSectionVisibility: true,
});
```

The instrumentation class accepts a subset of the full configuration such as framework selection, tracking toggles, and optional custom selectors.

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
| `rateLimitMs` | `100` | Minimum gap between events of the same type (applies to both the script-tag build and `DocsInstrumentation`). Distinct scroll depth thresholds are exempt, so a fast scroll still records every milestone. |

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
  supabaseUrl: 'SUPABASE_PROJECT_URL',
  supabaseKey: 'SUPABASE_PUBLISHABLE_KEY',
  framework: 'custom',
  searchSelector: '#search-input',
  copyButtonSelector: '.copy-btn',
  codeBlockSelector: 'pre code',
  contentSelector: 'article.content',
  tocSelector: 'nav.toc',
  feedbackSelector: null,
};
```
