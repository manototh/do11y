---
title: Get started
description: Set up a Tinybird account and datasource before installing Do11y.
head:
  - - meta
    - property: og:title
      content: Get started — Do11y
  - - meta
    - property: og:description
      content: Set up a Tinybird account and datasource before installing Do11y.
---

# Get started

Set up Do11y in two steps:

1. [Create a Tinybird account and datasource](#create-tinybird-account)
2. [Add Do11y to your documentation site](#add-do11y-to-your-documentation-site)

## Create Tinybird account

[Sign up for Tinybird](https://www.tinybird.co/signup) with GitHub or Google. No credit card required. The free tier includes 10 GB of storage with no time-based retention limits, enough for years of event data from most documentation sites.

## Create a datasource

Tinybird auto-creates a datasource on first ingest via the Events API if one doesn't exist. You can name it anything. The default in Do11y is `do11y`.

If you want to pre-create it with a schema, use the Tinybird CLI or UI:

```sql
CREATE DATASOURCE do11y (
  _time DateTime,
  eventType String,
  do11y_version String,
  sessionId String,
  sessionPageCount UInt32,
  path String,
  hash Nullable(String),
  search Nullable(String),
  title Nullable(String),
  viewportCategory String,
  browserFamily String,
  deviceType String,
  language String,
  timezoneOffset Float32
) ENGINE = MergeTree() ORDER BY (_time, eventType, path)
```

This is optional. If you skip it, Tinybird infers the schema from the first batch of events.

## Create a token

Create a token scoped to append data to your datasource:

1. In the Tinybird UI, go to **Tokens**.
2. Click **Create Token**.
3. Give it a name like `do11y-ingest`.
4. Under scopes, select **DATASOURCE:APPEND** and choose your datasource.
5. Copy the token.

<details>
<summary>Are append-only tokens safe to embed in client-side scripts?</summary>

Append-only tokens can write data but cannot read it, which makes them safe to embed in client-side scripts. If someone finds your token in the page source, they can write events to your Do11y datasource but cannot read your data or access other resources. The worst-case outcome is noise in a single analytics datasource.
</details>

## Choose your region

| Region | Host |
|---|---|
| US (default) | `api.tinybird.co` |
| EU | `api.eu-central-1.aws.tinybird.co` |

## Your credentials

You now have the three values Do11y needs:

| Value | Example | Config option |
|---|---|---|
| Host | `api.tinybird.co` | `tinybirdHost` |
| Datasource | `do11y` | `tinybirdDatasource` |
| Token | `p.eyJ...` | `tinybirdToken` |

## Add Do11y to your documentation site

Follow the install guide for your documentation framework:

- [Mintlify](/install/mintlify)
- [Docusaurus](/install/docusaurus)
- [Nextra](/install/nextra)
- [VitePress](/install/vitepress)
- [MkDocs Material](/install/mkdocs-material)
- [Other frameworks](/install/manual)

## Alternative: HTTP destination

If you prefer to send events to your own backend or a different analytics service, set `destination` to `'http'`:

```js
window.Do11yConfig = {
  destination: 'http',
  httpEndpoint: 'https://your-backend.com/events',
  httpHeaders: {
    'Authorization': 'Bearer your-token',
  },
};
```

Events are POSTed as a JSON array to the endpoint. The endpoint must be HTTPS.
