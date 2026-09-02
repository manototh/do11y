# Do11y

> Originally derived from [github.com/axiomhq/do11y](https://github.com/axiomhq/do11y)

Do11y is a documentation observability tool. It streams behavioral events from your docs site to [Supabase](https://supabase.com) (or any HTTP endpoint or OpenTelemetry-compatible backend) in real time:

- Page views
- Scroll depth
- Link clicks
- Search usage
- Code-block copies
- Section reading time
- Tab switches
- Table of contents (TOC) usage
- Feedback widget usage
- Expand/collapse interactions

Do11y is built for humans and machines alike. It emits observability data designed to be easy to use for human users, while also being easy to query and analyze for machines.

Do11y is agent-native: it detects AI platform referrers (ChatGPT, Perplexity, Claude, Gemini, and others) so you can understand how agents and humans engage with your content differently.

The standalone artifact is a single dependency-free JavaScript file. The source is TypeScript. [rolldown](https://rolldown.rs) produces the built output.

## Privacy

Do11y collects anonymous usage data:

- No cookies. Do11y uses `sessionStorage`, which the browser clears when the tab closes.
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
- Starlight (Astro)
- Docsy (Hugo)

For other frameworks, use manual setup with custom selectors.

## Setup

You can install Do11y as a standalone script or as an instrumentation layer on top of the official [OpenTelemetry Browser SDK](https://github.com/open-telemetry/opentelemetry-browser). Follow the [get started guide](https://docservable.com/get-started) to set up Do11y.

## Configuration

You can set options via meta tags or a configuration object. See the [configuration docs](https://docservable.com/configuration) for the full reference.

## Insights

Get [AI-powered recommendations](https://docservable.com/analyze) about what to fix.

## License

[MIT](LICENSE)
