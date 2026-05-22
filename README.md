# Do11y

> Originally derived from [github.com/axiomhq/do11y](https://github.com/axiomhq/do11y)

Do11y is a documentation observability tool. It streams behavioral events from your docs site to [Tinybird](https://www.tinybird.co) (or any HTTP endpoint) in real time:

- Page views
- Scroll depth
- Link clicks
- Search queries
- Code-block copies
- Section reading time
- Tab switches
- Table of contents (TOC) usage
- Feedback widget usage
- Expand/collapse interactions

Do11y is agent-native: it detects AI platform referrers (ChatGPT, Perplexity, Claude, Gemini, and others) so you can understand how agents and humans engage with your content differently.

The runtime artifact is a single dependency-free JavaScript file. The source is TypeScript (`src/do11y.ts`). [rolldown](https://rolldown.rs) produces the built output.

## Privacy

- No cookies. Uses `sessionStorage`, which the browser clears when it closes.
- No personally identifiable information (PII).
- No device fingerprinting.
- No cross-site tracking.

You don't need a GDPR consent banner.

## Supported frameworks

- Mintlify
- Docusaurus
- Nextra
- MkDocs Material
- VitePress

For other frameworks, use manual setup with custom selectors.

## Prerequisites

1. [Sign up for Tinybird](https://www.tinybird.co/signup) (free, no credit card).
2. Create a token with `DATASOURCE:APPEND` scope.

## Quick start (Mintlify)

1. Download the latest release from [GitHub releases](https://github.com/do11y/do11y/releases/latest).
2. Copy `dist/do11y.min.js` and `examples/do11y-config.example.js` to your docs repo.
3. Rename to `do11y-config.js` and fill in your credentials:

```js
window.Do11yConfig = {
  tinybirdHost: 'api.tinybird.co',
  tinybirdToken: 'YOUR_TINYBIRD_TOKEN',
  tinybirdDatasource: 'do11y',
  framework: 'mintlify',
};
```

## CDN install (Docusaurus)

```js
headTags: [
  { tagName: 'meta', attributes: { name: 'do11y-token', content: 'YOUR_TINYBIRD_TOKEN' } },
  { tagName: 'meta', attributes: { name: 'do11y-datasource', content: 'do11y' } },
  { tagName: 'meta', attributes: { name: 'do11y-host', content: 'api.tinybird.co' } },
  { tagName: 'meta', attributes: { name: 'do11y-framework', content: 'docusaurus' } },
],
scripts: [{ src: 'https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js', defer: true }],
```

## CDN install (Nextra)

```jsx
<Head>
  <meta name="do11y-token" content="YOUR_TINYBIRD_TOKEN" />
  <meta name="do11y-datasource" content="do11y" />
  <meta name="do11y-host" content="api.tinybird.co" />
  <meta name="do11y-framework" content="nextra" />
  <script src="https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

## CDN install (VitePress)

```js
head: [
  ['meta', { name: 'do11y-token', content: 'YOUR_TINYBIRD_TOKEN' }],
  ['meta', { name: 'do11y-datasource', content: 'do11y' }],
  ['meta', { name: 'do11y-host', content: 'api.tinybird.co' }],
  ['meta', { name: 'do11y-framework', content: 'vitepress' }],
  ['script', { src: 'https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js' }],
],
```

## CDN install (MkDocs Material)

In `mkdocs.yml`:

```yaml
extra_javascript:
  - https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js
```

In `overrides/main.html`:

```html
{% extends "base.html" %}
{% block extrahead %}
  <meta name="do11y-token" content="YOUR_TINYBIRD_TOKEN">
  <meta name="do11y-datasource" content="do11y">
  <meta name="do11y-host" content="api.tinybird.co">
  <meta name="do11y-framework" content="mkdocs-material">
{% endblock %}
```

## Generic HTTP destination

Send events to any HTTPS endpoint instead of Tinybird:

```js
window.Do11yConfig = {
  destination: 'http',
  httpEndpoint: 'https://your-backend.com/events',
  httpHeaders: { 'Authorization': 'Bearer your-token' },
  framework: 'docusaurus',
};
```

## Manual setup

```html
<meta name="do11y-token" content="YOUR_TINYBIRD_TOKEN">
<meta name="do11y-datasource" content="do11y">
<meta name="do11y-host" content="api.tinybird.co">
<meta name="do11y-framework" content="custom">
<script src="https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js"></script>
```

## Configuration

All options can be set via `window.Do11yConfig` or meta tags. See the [configuration docs](https://docservable.com/configuration) for the full reference.

### Destination

| Option | Default | Description |
|---|---|---|
| `destination` | `'tinybird'` | `'tinybird'` or `'http'` |
| `tinybirdHost` | `'api.tinybird.co'` | Tinybird API host |
| `tinybirdToken` | `''` | Token with DATASOURCE:APPEND scope |
| `tinybirdDatasource` | `'do11y'` | Tinybird datasource name |
| `httpEndpoint` | `''` | Full HTTPS URL (when destination is `'http'`) |
| `httpHeaders` | `{}` | Custom headers for HTTP destination |

## Insights

Get AI-powered recommendations about what to fix:

```bash
TINYBIRD_TOKEN=your-read-token \
OPENAI_API_KEY=sk-... \
npx tsx scripts/insights.ts
```

Produces a prioritized report of pages to fix based on engagement metrics.

## JavaScript API

```javascript
Do11y.getConfig()    // Current config (token redacted)
Do11y.isEnabled()    // Whether tracking is active
Do11y.flush()        // Force-send queued events
Do11y.getQueueSize() // Number of queued events
Do11y.version        // Script version
```

## License

MIT
