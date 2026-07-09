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