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
  ['meta', { name: 'do11y-url', content: 'SUPABASE_PROJECT_URL' }],
  ['meta', { name: 'do11y-key', content: 'SUPABASE_PUBLISHABLE_KEY' }],
  ['meta', { name: 'do11y-framework', content: 'vitepress' }],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js' }],
],
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script entry before the main script. VitePress supports inline scripts in the `head` array via the `innerHTML` property:

```js
head: [
  ['meta', { name: 'do11y-url', content: 'SUPABASE_PROJECT_URL' }],
  ['meta', { name: 'do11y-key', content: 'SUPABASE_PUBLISHABLE_KEY' }],
  ['meta', { name: 'do11y-framework', content: 'vitepress' }],
  ['script', {}, `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js' }],
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Get insights from your data](/analyze)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
