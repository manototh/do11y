---
title: Reference
description: Full reference for Do11y events schema, AI traffic detection fields, JavaScript API, and known limitations.
head:
  - - meta
    - property: og:title
      content: Reference — Do11y
  - - meta
    - property: og:description
      content: Full reference for Do11y events schema, AI traffic detection fields, JavaScript API, and known limitations.
---

# Reference

## Events

Every event includes: `sessionId`, `sessionPageCount`, `path`, `hash`, `title`, `viewportCategory`, `browserFamily`, `deviceType`, `language`, and `timezoneOffset`.

| Event | Description | Key fields |
|---|---|---|
| `page_view` | Fires on every page load or SPA navigation. | `referrerDomain`, `referrerCategory`, `aiPlatform`, `isFirstPage`, `previousPath` |
| `link_click` | Internal, external, anchor, or email link click. | `linkType`, `targetUrl`, `linkText`, `linkContext`, `linkSection`, `linkIndex` |
| `scroll_depth` | User scrolls past a configured threshold. | `threshold`, `scrollPercent` |
| `page_exit` | Fires on `beforeunload`. | `totalTimeSeconds`, `activeTimeSeconds`, `engagementRatio`, `maxScrollDepth`, `referrerCategory`, `aiPlatform` |
| `search_opened` | User opens the search dialog (click or Cmd/Ctrl+K). | `trigger` |
| `code_copied` | User clicks a code block's copy button. | `language`, `codeSection`, `codeBlockIndex` |
| `section_visible` | A heading stayed visible in the viewport long enough to read. | `heading`, `headingLevel`, `visibleSeconds` |
| `tab_switch` | User switches a code language/framework tab. | `tabLabel`, `tabGroup`, `isDefault` |
| `toc_click` | User clicks an entry in the on-page table of contents. | `heading`, `headingLevel`, `tocPosition` |
| `feedback` | User clicks a "Was this helpful?" button. | `rating` |
| `expand_collapse` | User toggles a `<details>` element or accordion. | `summary`, `action`, `section` |

## AI traffic detection

Do11y classifies referrer domains to detect traffic from AI platforms. Each `page_view` event includes:

| Field | Values | Description |
|---|---|---|
| `referrerCategory` | `ai`, `search-engine`, `social`, `community`, `code-host`, `direct`, `internal`, `other`, `unknown` | High-level traffic source category. |
| `aiPlatform` | `ChatGPT`, `Perplexity`, `Claude`, `Gemini`, `Copilot`, `DeepSeek`, `Meta AI`, `Grok`, `Mistral`, `You.com`, `Phind`, or `null` | Specific AI platform when `referrerCategory` is `ai`. |

Detection is referrer-based: it checks whether `document.referrer` hostname matches a known AI platform. No fingerprinting, user-agent parsing, or additional data collection.

**Limitation:** Most AI platforms (especially ChatGPT mobile and API-sourced visits) don't pass referrer headers. Those visits appear as `direct` traffic. Referrer-based detection typically captures 20–40% of AI traffic. Detecting the remaining "dark AI" traffic would require fingerprinting techniques that conflict with Do11y's privacy-first design. Partial signal is still actionable. If a specific page consistently receives referrals from ChatGPT or Perplexity, that tells you something real about how agents are using your content, even if the true volume is higher than the data shows.

## JavaScript API

Do11y exposes `window.Do11y` for debugging and integration:

```javascript
Do11y.getConfig()    // Current config (token redacted)
Do11y.isEnabled()    // Whether tracking is active
Do11y.flush()        // Force-send queued events
Do11y.getQueueSize() // Number of queued events
Do11y.version        // Script version
```

`cleanup()` and `debug()` are intentionally not exposed on the global object. Exposing `cleanup()` would allow any third-party script on the page to silently stop tracking. Exposing `debug()` would allow any script to enable verbose console output that reveals the configured ingest endpoint and queued event data.

## Known limitations

### Custom themes

The selectors work on sites using the standard theme of each supported framework. Heavily customized themes render elements differently. If you use a custom theme, set selectors manually using the [`custom` framework option](/configuration#custom-selectors).

### Framework selector drift

CSS selectors reflect each framework's current DOM output and may break when frameworks release major updates that change class names or HTML structure. The [test suites](/development#tests) exist specifically to catch this. Run them periodically to verify selectors still match.

### Code snippet language detection on Nextra

Do11y detects the programming language of the code snippets that readers copy, but it can't detect the language for documentation sites based on Nextra. The reason is that Nextra doesn't provide the language of the code snippet in the DOM. This is a fundamental limitation of Nextra's architecture and can't be solved by Do11y. If you use Nextra, the `code_copied` event will always report `language: "unknown"`.
