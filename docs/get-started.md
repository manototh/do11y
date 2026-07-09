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

Set up Do11y in two steps:

1. [Set up a Supabase project](#set-up-a-supabase-project)
1. [Add Do11y to your documentation site](#add-do11y-to-your-documentation-site)

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

To send events to any OpenTelemetry-compatible backend, set `destination` to `'otlp'`:

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

Cloud OTLP endpoints (Grafana, Datadog, Honeycomb, etc.) do not return CORS headers, so browsers block direct cross-origin POSTs. To use OTLP from a browser, run an [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) with a CORS HTTP receiver on your own domain, or use a lightweight CORS proxy. See the [configuration docs](/configuration#otlp) for a sample collector config.

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

Follow the install guide for your documentation framework:

- [Mintlify](/install/mintlify)
- [Docusaurus](/install/docusaurus)
- [Nextra](/install/nextra)
- [VitePress](/install/vitepress)
- [MkDocs Material](/install/mkdocs-material)
- [Starlight (Astro)](/install/starlight)
- [Other frameworks](/install/manual)
