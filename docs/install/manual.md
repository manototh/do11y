---
title: Manual setup
description: Install Do11y on any documentation framework via CDN or self-hosting.
head:
  - - meta
    - property: og:title
      content: Manual setup — Do11y
  - - meta
    - property: og:description
      content: Install Do11y on any documentation framework via CDN or self-hosting.
---

# Manual setup

Use manual setup for frameworks not listed in the supported frameworks, or for custom HTML sites.

## Option 1: CDN (recommended)

Add the following to every page of your docs site:

```html
<meta name="do11y-token" content="YOUR_TINYBIRD_TOKEN">
<meta name="do11y-datasource" content="do11y">
<meta name="do11y-host" content="api.tinybird.co">
<meta name="do11y-framework" content="FRAMEWORK">
<script src="https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js"></script>
```

Replace the meta tag values with your [Tinybird credentials](/get-started) and your framework name. To pin a specific version, replace `latest` with a version tag like `0.1.0`.

Set `FRAMEWORK` to one of the [supported framework values](/configuration#framework), or `'custom'` to provide your own selectors.

### Advanced configuration via CDN

Meta tags only cover the essential settings. To configure any [advanced options](/configuration) such as scroll thresholds, tracking toggles, or custom selectors, set `window.Do11yConfig` in an inline script placed **before** the CDN script:

```html
<script>
window.Do11yConfig = {
  tinybirdHost: 'api.tinybird.co',
  tinybirdToken: 'p.your-ingest-token',
  tinybirdDatasource: 'do11y',
  framework: 'vitepress',
  scrollThresholds: [25, 50, 75, 100],
  trackFeedback: false,
  sectionVisibleThreshold: 5,
};
</script>
<script src="https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js"></script>
```

When both are present, meta tags take precedence over `window.Do11yConfig`, which takes precedence over the defaults.

## Option 2: Self-host

If you can't use a CDN, host the script yourself.

1. Download the latest release from [GitHub](https://github.com/do11y/do11y/releases/latest) and extract the zip.
2. Copy `dist/do11y.min.js` and `examples/do11y-config.example.js` to your docs project (for example, `scripts/`).
3. Rename `do11y-config.example.js` to `do11y-config.js`.
4. In `do11y-config.js`, replace the placeholder values with your credentials:

```js
window.Do11yConfig = {
  tinybirdHost: 'api.tinybird.co',
  tinybirdToken: 'YOUR_TINYBIRD_TOKEN',
  tinybirdDatasource: 'do11y',
  framework: 'FRAMEWORK',
};
```

5. Add both scripts to every page, with the config file loading first:

```html
<script src="/path/to/do11y-config.js"></script>
<script src="/path/to/do11y.min.js"></script>
```

Don't edit `do11y.min.js` directly. It's a build artifact and updating to a new release overwrites it.

### Automatic sync via GitHub Action

If you self-host in a GitHub repo, the included `examples/sync-do11y-to-docs.yml` Action keeps your copy up to date automatically. It runs every Monday and opens a PR when a new release is available.

1. Copy `examples/sync-do11y-to-docs.yml` to `.github/workflows/` in your docs repo.
2. Create an empty file at `do11y.version` to track the installed version.
3. Add two repository variables under **Settings > Secrets and variables > Actions > Variables**:

| Variable | Example | Description |
|---|---|---|
| `DO11Y_JS_PATH` | `scripts/do11y.min.js` | Path to `do11y.min.js` in your docs repo. |
| `DO11Y_VER_PATH` | `scripts/do11y.version` | Path to the version tracking file. |

4. Go to **Settings > Actions > General > Workflow permissions** and enable **Allow GitHub Actions to create and approve pull requests**.

No secrets needed.
