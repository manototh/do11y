---
title: Get started
description: Set up a Supabase project and table before installing Do11y.
head:
  - - meta
    - property: og:title
      content: Get started — Do11y
  - - meta
    - property: og:description
      content: Set up a Supabase project and table before installing Do11y.
---

# Get started

Do11y offers two installation paths depending on your setup:

- **[Script tag](#add-do11y-to-your-documentation-site)** — drop a `<script>` into any HTML page. Zero build tooling required.
- **[npm / OpenTelemetry instrumentation](#npm-opentelemetry-instrumentation)** — install as a dependency and register alongside `@opentelemetry/browser-sdk` for users who already bundle their site.

Both paths need a destination to send events to. Start by setting up a [Supabase project](#set-up-a-supabase-project) or configuring an [OTLP endpoint](#alternative-otlp-destination).

## Set up a Supabase project

1. [Sign up for Supabase](https://supabase.com/dashboard). You don't need a credit card. The free tier includes more than enough storage for most docs sites with no time-based retention limits.

1. After you create your project, click **Copy** in the Project Overview page, and note your **Project URL** and **Publishable key**.

1. Open the **SQL Editor** in the left sidebar, and then run the following:

```sql
create table do11y_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table do11y_events enable row level security;

grant insert on do11y_events to anon;
grant select on do11y_events to service_role;

create policy "Allow anonymous inserts"
  on do11y_events for insert
  to anon
  with check (true);
```

This SQL script creates a table that accepts event data from Do11y and allows anonymous inserts via the publishable key. The publishable key cannot read data, only write it. The script also grants SELECT access on the table to the service role. This is needed for the insights script to work.

The default table name is `do11y_events`. If you use a different name, add the `supabaseTable` parameter to your Do11y configuration.

### Alternative: OTLP destination

To send events to an OpenTelemetry-compatible backend, set `destination` to `'otlp'`:

```js
window.Do11yConfig = {
  destination: 'otlp',
  otelSdkEndpoint: 'OTLP_ENDPOINT',
  otelSdkHeaders: {
    'Authorization': 'Bearer API_TOKEN',
  },
};
```

Replace `OTLP_ENDPOINT` and `API_TOKEN` with your own values. Do11y uses the official OpenTelemetry Browser SDK loaded dynamically from a CDN.

#### CORS

Cloud OTLP endpoints (Grafana, Datadog, Honeycomb, etc.) don't return CORS headers. This means that browsers block direct cross-origin POSTs. To use send Do11y data to cloud OTLP endpoints, run an [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) with a CORS HTTP receiver on your own domain, or use a lightweight CORS proxy. See the [configuration docs](/configuration#otlp) for a sample collector config.

### Alternative: Generic HTTP destination

To send events to your own backend or a different analytics service, set `destination` to `'http'`:

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

Do11y sends events as a JSON array of OTel-conformant event objects. The endpoint must use HTTPS.

## Add Do11y to your documentation site

### Script tag (traditional)

Follow the install guide for your documentation framework:

- [Mintlify](/install/mintlify)
- [Docusaurus](/install/docusaurus)
- [Nextra](/install/nextra)
- [VitePress](/install/vitepress)
- [MkDocs Material](/install/mkdocs-material)
- [Starlight (Astro)](/install/starlight)
- [Docsy (Hugo)](/install/docsy)
- [Other frameworks](/install/manual)

### npm / OpenTelemetry instrumentation

If you already bundle your site with a build tool (Vite, Webpack, etc.) and use the OpenTelemetry Browser SDK, install Do11y as an npm dependency:

```bash
npm install @manototh/do11y
```

Then register the `DocsInstrumentation` alongside your other instrumentations. With `@opentelemetry/browser-sdk`, start the logs SDK **first** (this registers the global `LoggerProvider`), then register the instrumentation:

```ts
import { startLogsSdk } from '@opentelemetry/browser-sdk/logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocsInstrumentation } from '@manototh/do11y/instrumentation';

// 1. Start the logs SDK — registers the global LoggerProvider.
startLogsSdk({
  serviceName: 'my-docs-site',
  logs: {
    exportConfig: {
      url: 'https://otel-collector.example.com/v1/logs',
    },
  },
});

// 2. Register the instrumentation (after the provider is set up).
registerInstrumentations({
  instrumentations: [
    new DocsInstrumentation({
      framework: 'mintlify',
      trackScrollDepth: true,
    }),
  ],
});
```

> **Note:** `@opentelemetry/browser-sdk` (v0.1.x) does not expose an `instrumentations` option on `startBrowserSdk`/`startLogsSdk`. Use `registerInstrumentations` from `@opentelemetry/instrumentation`, or construct `DocsInstrumentation` directly (its constructor self-enables). In both cases the SDK must be started before the instrumentation is created, and your `@opentelemetry/api-logs`/`@opentelemetry/instrumentation` versions should match the browser-sdk experimental line (0.220.x) or the 0.221.x line — Do11y supports both.

This sends documentation-specific events (scroll depth, tab switches, code copies, feedback, etc.) through the same OTel pipeline as your browser auto-instrumentations. Each record carries the standard `event.name` attribute plus `session.id`, making it easy to correlate docs behaviour with page load performance, API calls, and errors. If you use `@opentelemetry/browser-sdk` session processors instead, set `sessionAttributes: false` on `DocsInstrumentation` so the `session.id` attribute is not emitted twice.

The instrumentation class requires the `@opentelemetry/instrumentation` peer dependency (0.220.x or 0.221.x). If you use `startBrowserSdk` or `startLogsSdk` from `@opentelemetry/browser-sdk`, these are already included.
