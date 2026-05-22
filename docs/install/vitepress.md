---
title: Install on VitePress
description: Add Do11y to your VitePress documentation site via CDN using the head config array.
head:
  - - meta
    - property: og:title
      content: Install on VitePress — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your VitePress documentation site via CDN using the head config array.
---

# Install on VitePress

## Steps

Add the following to the `head` array in `.vitepress/config.js` or `.vitepress/config.ts`:

```js
head: [
  ['meta', { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' }],
  ['meta', { name: 'axiom-do11y-token', content: 'API_TOKEN' }],
  ['meta', { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' }],
  ['meta', { name: 'axiom-do11y-framework', content: 'vitepress' }],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js' }],
],
```

Replace `AXIOM_DOMAIN`, `API_TOKEN`, and `DATASET_NAME` with your [Axiom credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script entry before the main script. VitePress supports inline scripts in the `head` array via the `innerHTML` property:

```js
head: [
  ['meta', { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' }],
  ['meta', { name: 'axiom-do11y-token', content: 'API_TOKEN' }],
  ['meta', { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' }],
  ['meta', { name: 'axiom-do11y-framework', content: 'vitepress' }],
  ['script', {}, `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js' }],
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
