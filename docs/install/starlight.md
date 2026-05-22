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
export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      head: [
        { tag: 'meta', attrs: { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' } },
        { tag: 'meta', attrs: { name: 'axiom-do11y-token', content: 'API_TOKEN' } },
        { tag: 'meta', attrs: { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' } },
        { tag: 'meta', attrs: { name: 'axiom-do11y-framework', content: 'starlight' } },
        { tag: 'script', attrs: { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js' } },
      ],
    }),
  ],
});
```

Replace `AXIOM_DOMAIN`, `API_TOKEN`, and `DATASET_NAME` with your [Axiom credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script entry before the main script:

```js
head: [
  { tag: 'meta', attrs: { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' } },
  { tag: 'meta', attrs: { name: 'axiom-do11y-token', content: 'API_TOKEN' } },
  { tag: 'meta', attrs: { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' } },
  { tag: 'meta', attrs: { name: 'axiom-do11y-framework', content: 'starlight' } },
  { tag: 'script', content: `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };` },
  { tag: 'script', attrs: { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js' } },
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
