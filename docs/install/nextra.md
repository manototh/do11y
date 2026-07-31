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
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL" />
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY" />
  <meta name="do11y-framework" content="nextra" />
  <script src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

## App Router

Add the following to `app/layout.jsx` or `app/layout.tsx`:

```jsx
<Head>
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL" />
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY" />
  <meta name="do11y-framework" content="nextra" />
  <script src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

Replace `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` with your [Supabase credentials](/get-started).

## Advanced configuration

To use options beyond the basic credentials, add an inline script before the main script tag. The inline script must run before Do11y loads.

### App Router

Use Next.js's `<Script>` component with inline children instead of `dangerouslySetInnerHTML`. Inline scripts require an `id` prop:

```jsx
import Script from 'next/script'

<Head>
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL" />
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY" />
  <meta name="do11y-framework" content="nextra" />
</Head>
<Script id="do11y-config" strategy="beforeInteractive">
  {`window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };`}
</Script>
<Script
  src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js"
  strategy="afterInteractive"
/>
```

The `beforeInteractive` strategy guarantees the config is set before `do11y.js` runs.

### Pages Router

`next/script` does not support inline children in the Pages Router. Put the config in a static file instead:

Create `public/do11y-config.js`:

```js
window.Do11yConfig = { scrollThresholds: [25, 50, 75, 100] };
```

Then load it before Do11y:

```jsx
<Head>
  <meta name="do11y-url" content="SUPABASE_PROJECT_URL" />
  <meta name="do11y-key" content="SUPABASE_PUBLISHABLE_KEY" />
  <meta name="do11y-framework" content="nextra" />
  <script src="/do11y-config.js" />
  <script src="https://cdn.jsdelivr.net/npm/@manototh/do11y@latest/dist/do11y.min.js" defer />
</Head>
```

See the [configuration reference](/configuration) for all available options.

## Next steps

- [Get insights from your data](/analyze)
- [Query your data](/queries)
- [Advanced configuration](/configuration)
