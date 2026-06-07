---
title: Install on MkDocs Material
description: Add Do11y to your MkDocs Material documentation site via CDN using a theme override.
head:
  - - meta
    - property: og:title
      content: Install on MkDocs Material — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your MkDocs Material documentation site via CDN using a theme override.
---

# Install on MkDocs Material

## Steps

### 1. Update mkdocs.yml

Add the CDN script and point to a custom overrides directory:

```yaml
theme:
  name: material
  custom_dir: overrides
extra_javascript:
  - https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js
```

### 2. Create the overrides template

Create `overrides/main.html` to inject the configuration meta tags:

```html
{% extends "base.html" %}
{% block extrahead %}
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL">
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY">
  <meta name="do11y-framework" content="mkdocs-material">
{% endblock %}
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

See the [MkDocs Material docs](https://squidfunk.github.io/mkdocs-material/customization/#extending-the-theme) for more on theme overrides.

## Advanced configuration

To use options beyond the basic credentials, add an inline script in `overrides/main.html` before the CDN script loads. Because `extra_javascript` entries load after the page, place the inline config in the `extrahead` block as well:

```html
{% extends "base.html" %}
{% block extrahead %}
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL">
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY">
  <meta name="do11y-framework" content="mkdocs-material">
  <script>
    window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };
  </script>{% endblock %}
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

## Next steps

- [Get insights from your data](/insights)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
