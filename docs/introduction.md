---
title: Introduction
description: What Do11y is, why documentation needs dedicated observability, what it tracks, how it handles privacy, and which documentation frameworks it supports.
head:
  - - meta
    - property: og:title
      content: Introduction — Do11y
  - - meta
    - property: og:description
      content: What Do11y is, why documentation needs dedicated observability, what it tracks, how it handles privacy, and which documentation frameworks it supports.
---

# Introduction

Do11y is a documentation observability tool. It turns documentation usage into structured event data by streaming behavioral events from your docs site to [Supabase](https://supabase.com), any HTTP endpoint, or any OpenTelemetry-compatible backend via OTLP in real time.

Do11y is built for humans and machines alike. It emits observability data that is easy to query with SQL and easy to feed into automated insights pipelines.

Do11y is agent-native. It detects AI platform referrers so you can understand how agents and humans engage with your content differently.

The runtime artifact is a single dependency-free JavaScript file built from TypeScript with [rolldown](https://rolldown.rs). Load it from a CDN or self-host it.

## Why documentation observability

General web analytics tools were designed for marketing sites and e-commerce funnels. Their model is based on the visitor arriving, viewing pages, clicking links, converting or leaving. Applied to documentation, that model tends to answer the wrong questions.

Technical writers, information architects, and documentation engineers need different signals. Did users read the section they were looking for, or scroll past it? Which code example did they copy? When a user opens search immediately after landing on a page, is the content failing them? Those questions require events that general analytics tools don't track.

Do11y tracks documentation-specific behavior automatically. Section reading time records which headings stayed in the viewport long enough to be read, not just whether the user was on the page. Code-block copies capture which example, in which language, in which section. Tab switches tell you which framework or language your audience actually uses. Table of contents (TOC) usage can be a hint for page organization as high click rates can signal that a page is too long or poorly structured.

General analytics tools also lock you into their reporting interface. Do11y sends raw events to Supabase (PostgreSQL), where you query them with SQL and full flexibility. You can ask questions that a prebuilt dashboard would never surface, such as which sessions copied a code block and then exited without navigating further.

The privacy profile is different too. Tools that rely on cookies or build persistent user profiles require a GDPR/CCPA consent banner. Do11y uses `sessionStorage`, collects no personal data, and does no fingerprinting, which removes that compliance overhead for most teams. You usually don't need a GDPR/CCPA consent banner for using Do11y. If your organization has specific compliance obligations, verify with your legal team.

General analytics tools are fine if your team's primary question is "how do people find our docs site?" Do11y doesn't replace these tools for marketing-level traffic analysis. But if you're looking for signals about how users actually use your docs and whether they're able to achieve their goals, Do11y is a great fit.

## Events

Do11y streams the following behavioral events:

| Event | Description |
|---|---|
| Page views | Every page load and SPA navigation, with referrer and AI platform classification. |
| Scroll depth | How far down the page users actually scroll. |
| Link clicks | Internal links, external links, anchor links, and email links. |
| Search queries | When users open the search dialog. |
| Code-block copies | Which code blocks users copy and in which language. |
| Section reading time | How long each heading stays in the viewport. |
| Tab switches | Which code language or framework tab users select. |
| TOC usage | Which table of contents entries users click. |
| Feedback | "Was this helpful?" widget responses. |
| Expand/collapse | Interactions with `<details>` elements and accordions. |

These events are specific to how documentation is used. Knowing which sections users actually read, which code examples they copy, and where they stop engaging gives you signal that general web analytics tools don't surface.

## Privacy

Do11y collects anonymous usage data with no impact on user privacy:

- No cookies. Do11y uses `sessionStorage`, which the browser clears when it closes.
- No personally identifiable information (PII).
- No device fingerprinting.
- No cross-site tracking.

Because Do11y uses no cookies and collects no personal data, it doesn't trigger consent requirements under GDPR's cookie rules or CCPA's personal information provisions. You usually don't need a GDPR consent banner for using Do11y. If your organization has specific compliance obligations, verify with your legal team.

## Supported frameworks

Do11y supports the latest versions of the following documentation frameworks out of the box:

| Framework | Install guide |
|---|---|
| [Mintlify](https://mintlify.com) | [Install on Mintlify](/install/mintlify) |
| [Docusaurus](https://docusaurus.io) | [Install on Docusaurus](/install/docusaurus) |
| [Nextra](https://nextra.site) | [Install on Nextra](/install/nextra) |
| [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) | [Install on MkDocs Material](/install/mkdocs-material) |
| [VitePress](https://vitepress.dev) | [Install on VitePress](/install/vitepress) |
| [Starlight (Astro)](https://starlight.astro.build/) | [Install on Starlight](/install/starlight) |

For other frameworks, use [manual setup](/install/manual).
