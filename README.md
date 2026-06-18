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

Do11y is built for humans and machines alike. It emits observability data designed to be easy to use for human users, while also being easy to query and analyze for machines.

Do11y is agent-native: it detects AI platform referrers (ChatGPT, Perplexity, Claude, Gemini, and others) so you can understand how agents and humans engage with your content differently.

The runtime artifact is a single dependency-free JavaScript file. The source is TypeScript (`src/do11y.ts`). [rolldown](https://rolldown.rs) produces the built output.

## Privacy

Do11y collects anonymous usage data:

- No cookies. Do11y uses `sessionStorage`, which the browser clears when it closes.
- No personally identifiable information (PII).
- No device fingerprinting.
- No cross-site tracking.

Because Do11y uses no cookies and collects no personal data, it doesn't trigger consent requirements under GDPR's cookie rules or CCPA's personal information provisions. You usually don't need a GDPR consent banner for using Do11y. If your organization has specific compliance obligations, verify with your legal team.


## Supported frameworks

Do11y supports the latest versions of the following frameworks:

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

Get [AI-powered recommendations](https://docservable.com/analyze) about what to fix.

## License

[MIT](LICENSE)
