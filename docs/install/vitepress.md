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
  ['meta', { name: 'do11y-url', content: 'https://YOUR_PROJECT.supabase.co' }],
  ['meta', { name: 'do11y-key', content: 'YOUR_ANON_KEY' }],
  ['meta', { name: 'do11y-framework', content: 'vitepress' }],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js' }],
],
```

Replace the values with your [Supabase credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script entry before the main script. VitePress supports inline scripts in the `head` array via the `innerHTML` property:

```js
head: [
  ['meta', { name: 'do11y-url', content: 'https://YOUR_PROJECT.supabase.co' }],
  ['meta', { name: 'do11y-key', content: 'YOUR_ANON_KEY' }],
  ['meta', { name: 'do11y-framework', content: 'vitepress' }],
  ['script', {}, `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js' }],
],
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Get insights from your data](/insights)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
