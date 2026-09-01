---
title: Destinations and setup paths
description: How to choose between setup paths and destinations.
head:
  - - meta
    - property: og:title
      content: Destinations and setup paths — Do11y
  - - meta
    - property: og:description
      content: How to choose between setup paths and destinations.
---

# Destinations and setup paths

Setup paths determine how Do11y runs on your site. Destinations determine where the event data goes.

| | Standalone | OpenTelemetry instrumentation |
|---|---|---|
| **What it is** | One dependency-free `do11y.min.js` file, loaded from a CDN or self-hosted | `DocsInstrumentation`, an npm dependency that plugs into `@opentelemetry/browser-sdk` |
| **Build tooling** | None | Requires a bundler (Vite, Webpack, etc.) and the OpenTelemetry Browser SDK |
| **Transport** | Do11y's own transport | OpenTelemetry Browser SDK pipeline |
| **Supported destinations** | Supabase, HTTP, OTLP | OTLP |
| **Supported frameworks** | All | Docusaurus, Nextra, VitePress, Starlight |

Hosted platforms (Mintlify) and static sites (MkDocs Material, Docsy) can only use the standalone path. Sites that bundle JavaScript (Docusaurus, Nextra, VitePress, Starlight) can use either path. The constraint is the site's build tooling, not Do11y's framework support.

## Standalone path

Configure where to send events with the `destination` option.

| Option | Default | Description |
|---|---|---|
| `destination` | `'supabase'` | Where to send events. `'supabase'`, `'http'`, or `'otlp'`. |

### Standalone + Supabase (recommended)

The Standalone path with the Supabase destination is the easiest way to set up Do11y. It's free, requires no external runtime dependencies, and provides a queryable PostgreSQL store. For this setup, follow the [Get started](/get-started) guide. Everything else is an alternative for teams with specific backend requirements.

| Option | Default | Description |
|---|---|---|
| `supabaseUrl` | `''` | Your Supabase project URL. For example: `https://abc123.supabase.co` |
| `supabaseKey` | `''` | Publishable key. For example: `sb_publishable_1234567890` |
| `supabaseTable` | `'do11y_events'` | Name of the table to insert events into. |

### Standalone + generic HTTP

To send events to an HTTPS endpoint, set `destination` to `'http'` and provide the `endpoint`. Optionally, set `headers` and `bodyTransform`. Do11y sends the events as a JSON array.

```js
window.Do11yConfig = {
  destination: 'http',
  endpoint: 'BACKEND_URL',
  headers: {
    'Authorization': 'Bearer API_TOKEN',
  },
};
```

Replace `BACKEND_URL` and `API_TOKEN` with your own values.

| Option | Default | Description |
|---|---|---|
| `endpoint` | `''` | Full URL to POST events to. Must be HTTPS. |
| `headers` | `{}` | Custom headers to include (for example, authorization). |
| `bodyTransform` | `undefined` | Optional function to transform the event array before sending. Receives the events array and returns what you want to serialize as JSON. Example: `(events) => ({ events })`. |

### Standalone + OTLP

To send events to any OpenTelemetry-compatible backend like Grafana, Datadog, or Honeycomb, set `destination` to `'otlp'`, and provide the `otelSdkEndpoint` and optional `otelSdkHeaders`.

```js
window.Do11yConfig = {
  destination: 'otlp',
  otelSdkEndpoint: 'OTLP_ENDPOINT',
  otelSdkHeaders: {
    'Authorization': 'Bearer API_TOKEN',
  },
};
```

Replace `OTLP_ENDPOINT` and `API_TOKEN` with your own values.

If you use the OTLP destination, your Do11y implementation relies on external dependencies. Do11y dynamically loads the [OpenTelemetry Browser SDK](https://github.com/open-telemetry/opentelemetry-browser) via a CDN and sends events as OTel LogRecords. The event name goes in the top-level `event_name` field, the event's `_time` becomes the record timestamp, and all other fields become attributes.

| Option | Default | Description |
|---|---|---|
| `otelSdkEndpoint` | `''` | Your OTLP collector URL. For example: `https://otlp.grafana.com/otlp`. The `/v1/logs` path is appended automatically. |
| `otelSdkHeaders` | `{}` | Custom headers for the OTLP request (for example, authorization). |
| `otelSdkServiceName` | `'do11y'` | Value of the `service.name` resource attribute. |
| `otelSdkResourceAttributes` | `{}` | Extra resource attributes to attach to every exported LogRecord. |

#### CORS and the OTel Collector

OTLP endpoints are designed for backend-to-backend communication and most cloud services don't return CORS headers. This means browsers block cross-origin requests directly to them.

The standard OTel solution is to run a local [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) that accepts CORS requests from your docs domain and forwards them to your backend. You can configure the collector with a [CORS HTTP receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/corsreceiver):

Add the following to your `otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - ALLOWED_DOCS_DOMAIN
          allowed_headers:
            - Content-Type
            - Authorization

exporters:
  otlphttp:
    endpoint: https://BACKEND_ENDPOINT/otlp
    headers:
      Authorization: "API_TOKEN"

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [otlphttp]
```

Replace `ALLOWED_DOCS_DOMAIN`, `BACKEND_ENDPOINT`, and `API_TOKEN` with your backend's values.

If you can't run a collector, use a lightweight CORS proxy such as [cors-anywhere](https://github.com/Rob--W/cors-anywhere) or a Cloudflare Worker that adds the required headers.

## OpenTelemetry instrumentation

`DocsInstrumentation` emits events through the OTel API. The destination is whatever exporter you configure on the OTel SDK:

```ts
import { startLogsSdk } from '@opentelemetry/browser-sdk/logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocsInstrumentation } from '@manototh/do11y/instrumentation';

// 1. Start the logs SDK — registers the global LoggerProvider and defines
//    where records go (OTLP by default).
startLogsSdk({
  serviceName: 'my-docs-site',
  exportConfig: {
    url: 'https://otel-collector.example.com/v1/logs',
  },
});

// 2. Register Do11y alongside your other instrumentations.
registerInstrumentations({
  instrumentations: [
    new DocsInstrumentation({ framework: 'docusaurus' }),
  ],
});
```
