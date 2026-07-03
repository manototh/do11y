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

## v0.0.4

**Release date:** 2026-07-03

- Starlight (Astro) support. Setting up Do11y on Starlight documentation sites is now much easier. For more information, see [Install on Starlight](/install/starlight).
- Improve programming language detection in copied code blocks on Mintlify

## v0.0.3

**Release date:** 2026-06-19

- Initial release after forking [github.com/axiomhq/do11y](https://github.com/axiomhq/do11y)
- Longer free data retention. The default datastore now uses Supabase, so you can keep your data for longer on a free plan.
- Bring your own backend. Send, store, and analyze Do11y data using any HTTP-compatible destination. You’re no longer tied to the default datastore.
- Fix code copy button detection and TOC click tracking on VitePress.