# Do11y

> Originally derived from [github.com/axiomhq/do11y](https://github.com/axiomhq/do11y)

Do11y is a documentation observability tool. It streams behavioral events from your docs site to [Supabase](https://supabase.com) (or any HTTP endpoint) in real time:

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

## Setup

Follow the [get started guide](https://docservable.com/get-started) to set up Do11y.

## Configuration

You can set all options via `window.Do11yConfig` or meta tags. See the [configuration docs](https://docservable.com/configuration) for the full reference.

## Insights

Get AI-powered recommendations about what to fix. See the [insights docs](https://docservable.com/insights) for more information.

## License

MIT
