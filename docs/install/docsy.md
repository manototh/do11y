---
title: Install on Hugo Docsy
description: Add Do11y to your Hugo Docsy documentation site via a head partial hook.
head:
  - - meta
    - property: og:title
      content: Install on Hugo Docsy — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your Hugo Docsy documentation site via a head partial hook.
---

# Install on Hugo Docsy

## Steps

Create `layouts/partials/hooks/head-end.html` in your Hugo project with the following content:

```html
<meta name="do11y-url" content="SUPABASE_PROJECT_URL">
<meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY">
<meta name="do11y-framework" content="docsy">
<script src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js"></script>
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

Docsy includes a `hooks/head-end.html` placeholder partial that gets injected just before the closing `</head>` tag on every page. By creating your own version of this partial in `layouts/partials/hooks/head-end.html`, your code is automatically included site-wide.

## Advanced configuration

To use options beyond the basic credentials, add an inline config script before the main script in `layouts/partials/hooks/head-end.html`:

```html
<script>
window.Do11yConfig = {
  supabaseUrl: 'SUPABASE_PROJECT_URL',
  supabaseKey: 'SUPABASE_PUBLISHABLE_KEY',
  supabaseTable: 'do11y_events',
  framework: 'docsy',
  debug: false,
};
</script>
<script src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js"></script>
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Get insights from your data](/analyze)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
