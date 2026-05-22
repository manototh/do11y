---
title: Install on Nextra
description: Add Do11y to your Nextra documentation site via CDN using the Head component.
head:
  - - meta
    - property: og:title
      content: Install on Nextra — Do11y
  - - meta
    - property: og:description
      content: Add Do11y to your Nextra documentation site via CDN using the Head component.
---

# Install on Nextra

## Pages Router

Add the following to the `<Head>` component in `pages/_app.jsx` or `pages/_app.tsx`:

```jsx
<Head>
  <meta name="axiom-do11y-domain" content="AXIOM_DOMAIN" />
  <meta name="axiom-do11y-token" content="API_TOKEN" />
  <meta name="axiom-do11y-dataset" content="DATASET_NAME" />
  <meta name="axiom-do11y-framework" content="nextra" />
  <script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

## App Router

Add the following to `app/layout.jsx` or `app/layout.tsx`:

```jsx
<Head>
  <meta name="axiom-do11y-domain" content="AXIOM_DOMAIN" />
  <meta name="axiom-do11y-token" content="API_TOKEN" />
  <meta name="axiom-do11y-dataset" content="DATASET_NAME" />
  <meta name="axiom-do11y-framework" content="nextra" />
  <script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

Replace `AXIOM_DOMAIN`, `API_TOKEN`, and `DATASET_NAME` with your [Axiom credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script before the main script tag. The inline script must run before Do11y loads:

```jsx
<Head>
  <meta name="axiom-do11y-domain" content="AXIOM_DOMAIN" />
  <meta name="axiom-do11y-token" content="API_TOKEN" />
  <meta name="axiom-do11y-dataset" content="DATASET_NAME" />
  <meta name="axiom-do11y-framework" content="nextra" />
  <script
    dangerouslySetInnerHTML={{
      __html: `window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`,
    }}
  />
  <script src="https://cdn.jsdelivr.net/npm/@axiomhq/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Analyze data in the integration dashboard](/integration-dashboard)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
