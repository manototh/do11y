---
title: Changelog
description: Release history for Do11y.
head:
  - - meta
    - property: og:title
      content: Changelog — Do11y
  - - meta
    - property: og:description
      content: Release history for Do11y.
---

# Changelog

## v0.2.1

**Release date:** 2026-07-31

- **OTLP event records follow the current OTel conventions.** The event name is carried only in the top-level `event_name` LogRecord field (per the OpenTelemetry logs data model), no longer duplicated as an `event.name` attribute. The `_time` value is now passed as the record timestamp (`timeUnixNano`) instead of being sent as a redundant attribute.
- **Pinned OTel SDK versions for the script-tag OTLP destination.** The CDN packages (`@opentelemetry/api-logs`, `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-logs-otlp-http`) are now pinned to `0.221.0`, matching the npm dependencies, so upgrades are deliberate rather than silent.
- **Explicit timestamps in the npm instrumentation.** `DocsInstrumentation` now sets the record `timestamp` explicitly on emit.

## v0.2.0

**Release date:** 2026-07-31

- **Use Do11y with the OpenTelemetry Browser SDK (npm).** If you already bundle your site with a build tool (Vite, Webpack, etc.) and use `@opentelemetry/browser-sdk`, you can now install Do11y as an npm dependency and register `DocsInstrumentation` alongside your other instrumentations. All documentation events (page views, scroll depth, section visibility, tab switches, code copies, TOC clicks, search, expand/collapse, link clicks, feedback) flow through your existing OTel pipeline under the same `session.id` — no separate queue, batching, or destination config required. For setup, see [Get started](/get-started#npm-opentelemetry-instrumentation).
- **New `@manototh/do11y/instrumentation` import.** Add `DocsInstrumentation` to your OTel SDK's `instrumentations` array to get docs-specific events alongside your browser auto-instrumentations, correlated with page load performance, API calls, and errors.
- **Script tag users: nothing changes.** The standalone script still works exactly as before, with the same config options and Supabase, HTTP, and OTLP destinations.
- **Breaking change to the data schema.** The `url.query` attribute was replaced by `browser.do11y.url.has_params`. The value semantics are unchanged (`'has_params'` or `null`), but the attribute is renamed and namespaced under `browser.do11y.*`. Update any dashboards, queries, or alerts that reference `url.query`.
- **Under the hood.** The codebase was refactored into a shared core library, the standalone script build, and the new OTel instrumentation layer, with a new Vitest-based test suite.

## v0.1.2

**Release date:** 2026-07-28

- Fix page view and page exit detection on Mintlify documentation sites.
- Improve handling of test-specific fields.

## v0.1.1

**Release date:** 2026-07-10

- **Docsy (Hugo) support:** You can now set up Do11y on Docsy documentation sites with a few meta tags. For more information, see [Install on Docsy](/install/docsy).
- Fix duplicate page views on documentation sites with iframes.

## v0.1.0

**Release date:** 2026-07-09

- **OTel semantic convention alignment.** All event and attribute names now follow [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/).
  - Event names use the `browser.do11y.*` namespace (e.g., `browser.do11y.page_view`, `browser.do11y.link_click`)
  - Attribute names use OTel standard keys where available (`session.id`, `url.path`, `device.type`, `browser.family`)
  - Custom do11y attributes use `browser.do11y.*` prefix (e.g., `browser.do11y.referrer_category`, `browser.do11y.scroll.threshold`)
- **OTLP destination with OTel Browser SDK.** You can now send Do11y data to an OTLP-compatible backend. The OTLP destination uses the official OpenTelemetry Browser SDK, loaded dynamically from a CDN. The SDK provides proper batching, retries, and backpressure via `BatchLogRecordProcessor`.
- **`bodyTransform` hook for HTTP destinations.** The `http` destination now accepts a `bodyTransform` function to shape the request body. The `supabase` destination uses this internally.
- **Renamed config options.** `httpEndpoint` → `endpoint`, `httpHeaders` → `headers`, `otlpEndpoint` → `otelSdkEndpoint`, `otlpHeaders` → `otelSdkHeaders`.
- **Breaking changes.** No backward compatibility. See the [migration guide](/configuration) for details.

## v0.0.4

**Release date:** 2026-07-03

- **Starlight (Astro) support.** Setting up Do11y on Starlight documentation sites is now much easier. For more information, see [Install on Starlight](/install/starlight).
- Improve programming language detection in copied code blocks on Mintlify

## v0.0.3

**Release date:** 2026-06-19

- Initial release after forking [github.com/axiomhq/do11y](https://github.com/axiomhq/do11y)
- **Longer free data retention.** The default datastore now uses Supabase, so you can keep your data for longer on a free plan.
- **Bring your own backend.** Send, store, and analyze Do11y data using any HTTP-compatible destination. You’re no longer tied to the default datastore.
- Fix code copy button detection and TOC click tracking on VitePress.