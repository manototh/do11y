---
title: Install on Mintlify
description: Add Do11y to your Mintlify documentation site in a few steps using self-hosted scripts.
head:
  - - meta
    - property: og:title
      content: Install on Mintlify — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your Mintlify documentation site in a few steps using self-hosted scripts.
---

# Install on Mintlify

Mintlify doesn't support loading scripts from a CDN via config, so Do11y must be self-hosted in your docs repo.

## Steps

1. Download the latest release from [GitHub](https://github.com/manototh/docservable/releases/latest) and extract the `do11y-<version>.zip` file.

2. Copy `dist/do11y.min.js` and `examples/do11y-config.example.js` to the same folder in your docs repo (for example, `scripts/`). Alphabetical ordering ensures the config file loads before the main script.

3. Rename `do11y-config.example.js` to `do11y-config.js`.

4. In `do11y-config.js`, replace the placeholder values with your Supabase credentials:

```js
window.Do11yConfig = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseKey: 'YOUR_ANON_KEY',
  framework: 'mintlify',
};
```

Replace the values with your [Supabase credentials](/get-started).

5. Optional: [Set up the automatic sync](/install/manual#automatic-sync-via-github-action) to keep `do11y.min.js` up to date automatically.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
