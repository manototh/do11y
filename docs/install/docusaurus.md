---
title: Install on Docusaurus
description: Add Do11y to your Docusaurus documentation site via CDN using headTags and scripts config.
head:
  - - meta
    - property: og:title
      content: Install on Docusaurus — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your Docusaurus documentation site via CDN using headTags and scripts config.
---

# Install on Docusaurus

## Steps

Add the following to the `headTags` and `scripts` fields in `docusaurus.config.js` (or `docusaurus.config.ts`):

```js
headTags: [
  { tagName: 'meta', attributes: { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-token', content: 'API_TOKEN' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-framework', content: 'docusaurus' } },
],
scripts: [
  { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js', defer: true },
],
```

Replace `AXIOM_DOMAIN`, `API_TOKEN`, and `DATASET_NAME` with your [Axiom credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials (scroll thresholds, tracking toggles, custom selectors), add an inline `<script>` entry to `headTags` that sets `window.Do11yConfig` before the main script loads:

```js
headTags: [
  { tagName: 'meta', attributes: { name: 'axiom-do11y-domain', content: 'AXIOM_DOMAIN' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-token', content: 'API_TOKEN' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-dataset', content: 'DATASET_NAME' } },
  { tagName: 'meta', attributes: { name: 'axiom-do11y-framework', content: 'docusaurus' } },
  {
    tagName: 'script',
    attributes: {},
    innerHTML: `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`,
  },
],
scripts: [
  { src: 'https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js', defer: true },
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
