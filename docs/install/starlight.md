---
title: Install on Starlight (Astro)
description: Add Do11y to your Astro Starlight documentation site using the head config in astro.config.mjs.
head:
  - - meta
    - property: og:title
      content: Install on Starlight (Astro) — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your Astro Starlight documentation site using the head config in astro.config.mjs.
---

# Install on Starlight (Astro)

## Steps

Add the following to the `head` array in your Starlight configuration inside `astro.config.mjs`:

```js
head: [
  { tag: 'meta', attrs: { name: 'do11y-url', content: 'SUPABASE_PROJECT_URL' } },
  { tag: 'meta', attrs: { name: 'do11y-key', content: 'SUPABASE_PUBLISHABLE_KEY' } },
  { tag: 'meta', attrs: { name: 'do11y-framework', content: 'starlight' } },
  { tag: 'script', attrs: { src: 'https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js' } },
],
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script entry before the main script:

```js
head: [
  { tag: 'meta', attrs: { name: 'do11y-url', content: 'SUPABASE_PROJECT_URL' } },
  { tag: 'meta', attrs: { name: 'do11y-key', content: 'SUPABASE_PUBLISHABLE_KEY' } },
  { tag: 'meta', attrs: { name: 'do11y-dataset', content: 'DATASET_NAME' } },
  { tag: 'meta', attrs: { name: 'do11y-framework', content: 'starlight' } },
  { tag: 'script', content: `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };` },
  { tag: 'script', attrs: { src: 'https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js' } },
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
