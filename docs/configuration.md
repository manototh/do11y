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

Do11y supports three destinations for event data: Supabase (default), generic HTTP, and OTLP via the OpenTelemetry Browser SDK.

| Option | Default | Description |
|---|---|---|
| `destination` | `'supabase'` | Where to send events. `'supabase'`, `'http'`, or `'otlp'`. |

### Supabase (default)

The `supabase` destination is a preset over the `http` destination. It automatically configures the endpoint, headers, and body transform for Supabase's REST API.

| Option | Default | Description |
|---|---|---|
| `supabaseUrl` | `''` | Your Supabase project URL. For example: `https://abc123.supabase.co` |
| `supabaseKey` | `''` | Publishable key. For example: `sb_publishable_1234567890` |
| `supabaseTable` | `'do11y_events'` | Name of the table to insert events into. |

Under the hood, this sets:
- `endpoint` to `<supabaseUrl>/rest/v1/<supabaseTable>`
- `headers` with Supabase REST headers
- `bodyTransform` to `(events) => events.map(e => ({ payload: e }))`

### HTTP

To send events to a HTTPS endpoint, set `destination` to `'http'`, and provide the `endpoint` and optional `headers` and `bodyTransform`. Do11y sends the events as a JSON array with `Content-Type: application/json`.

| Option | Default | Description |
|---|---|---|
| `endpoint` | `''` | Full URL to POST events to. Must be HTTPS. |
| `headers` | `{}` | Custom headers to include (for example, authorization). |
| `bodyTransform` | `undefined` | Optional function to transform the event array before sending. Receives the events array and returns what you want to serialize as JSON. Example: `(events) => ({ events })`. |

### OTLP (OpenTelemetry Protocol)

To send events to an OpenTelemetry-compatible backend, set `destination` to `'otlp'`. 

::: tip NOTE

If you use the OTLP destination, your Do11y implementation relies on external dependencies. Do11y dynamically loads the [OpenTelemetry Browser SDK](https://github.com/open-telemetry/opentelemetry-browser) via a CDN, and creates a standard `LoggerProvider` → `BatchLogRecordProcessor` → `OTLPLogExporter` pipeline, and sends events as properly-structured OTel LogRecords.

:::

| Option | Default | Description |
|---|---|---|
| `otelSdkEndpoint` | `''` | Your OTLP collector URL. For example: `https://otlp.grafana.com/otlp`. The `/v1/logs` path is appended automatically. |
| `otelSdkHeaders` | `{}` | Custom headers for the OTLP request (for example, authorization). |
| `otelSdkServiceName` | `'do11y'` | Value of the `service.name` resource attribute. |
| `otelSdkResourceAttributes` | `{}` | Extra resource attributes to attach to every exported LogRecord. |
| `otelSdkCdnUrl` | `'https://esm.sh/'` | CDN base URL for dynamically importing OTel SDK packages. Override for self-hosted or mirrored packages. |
| `useOtelBrowserInstrumentations` (coming soon) | `false` | When `true`, also registers standard OTel Browser instrumentations (navigation, user action, web vitals, errors). |

#### CORS and the OTel Collector

OTLP endpoints are designed for backend-to-backend communication and most cloud services (Grafana, Datadog, etc.) don't return CORS headers, which means browsers block cross-origin requests directly to them.

The standard OTel solution is to run a local [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) that accepts CORS requests from your docs domain and forwards them to your backend. You can configure the collector with a [CORS HTTP receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/corsreceiver):

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - https://docs.example.com
            - https://your-docs-domain.com
            - http://localhost:*
          allowed_headers:
            - Content-Type
            - Authorization

exporters:
  otlphttp:
    endpoint: https://otlp.grafana.com/otlp

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [otlphttp]
```

Set `otelSdkEndpoint` to your collector (for example, `https://collector.example.com:4318`). The collector handles authentication and forwarding to your cloud backend.

If you cannot run a collector, use a lightweight CORS proxy (such as [cors-anywhere](https://github.com/Rob--W/cors-anywhere) or a Cloudflare Worker) that adds the required headers.

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
| `'starlight'` | [Starlight](https://starlight.astro.build) (Astro) |
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
