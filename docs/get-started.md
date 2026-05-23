---
title: Get started
description: Set up a Supabase project and table before installing Do11y.
head:
  - - meta
    - property: og:title
      content: Get started — Do11y
  - - meta
    - property: og:description
      content: Set up a Supabase project and table before installing Do11y.
---

# Get started

Set up Do11y in two steps:

1. [Create a Supabase project](#create-a-supabase-project)
2. [Add Do11y to your documentation site](#add-do11y-to-your-documentation-site)

## Create a Supabase project

[Sign up for Supabase](https://supabase.com/dashboard) with GitHub or Google. No credit card required. The free tier includes 500 MB of database storage with no time-based retention limits.

A project is created automatically when you sign up. Note your **Project URL** and **anon key** from **Settings > API Keys** (or the home screen of your project).

## Create the events table

Open the **SQL Editor** in the Supabase dashboard and run this:

```sql
create table do11y_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table do11y_events enable row level security;

create policy "Allow anonymous inserts"
  on do11y_events for insert
  to anon
  with check (true);
```

This creates a table that accepts event data from Do11y and allows anonymous inserts via the public anon key. The anon key cannot read data, only write it.

## Your credentials

You now have the two values Do11y needs:

| Value | Example | Config option |
|---|---|---|
| Project URL | `https://abc123.supabase.co` | `supabaseUrl` |
| Anon key | `eyJhbG...` | `supabaseKey` |

The table name defaults to `do11y_events`. Change it with the `supabaseTable` option if you used a different name.

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
