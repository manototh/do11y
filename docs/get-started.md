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

[Sign up for Supabase](https://supabase.com/dashboard). You don't need a credit card. The free tier includes more than enough storage for most docs sites with no time-based retention limits.

After you create your project, click **Copy** in the Project Overview page, and note your **Project URL** and **Publishable key**.

## Create the events table

In Supabase, open the **SQL Editor** in the left sidebar and run the following:

```sql
create table do11y_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table do11y_events enable row level security;

grant insert on do11y_events to anon;
grant select on do11y_events to service_role;

create policy "Allow anonymous inserts"
  on do11y_events for insert
  to anon
  with check (true);
```

This SQL script creates a table that accepts event data from Do11y and allows anonymous inserts via the publishable key. The publishable key cannot read data, only write it. The script also grants SELECT access on the table to the service role. This is needed for the insights script to work.

The default table name is `do11y_events`. If you use a different name, add the `supabaseTable` parameter to your Do11y configuration.

## Add Do11y to your documentation site

Follow the install guide for your documentation framework:

- [Mintlify](/install/mintlify)
- [Docusaurus](/install/docusaurus)
- [Nextra](/install/nextra)
- [VitePress](/install/vitepress)
- [MkDocs Material](/install/mkdocs-material)
- [Other frameworks](/install/manual)

## Alternative: HTTP destination

To send events to your own backend or a different analytics service, set `destination` to `'http'`:

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
