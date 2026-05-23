---
title: Queries
description: Example SQL queries for analyzing documentation usage data collected by Do11y in Supabase.
head:
  - - meta
    - property: og:title
      content: Queries — Do11y
  - - meta
    - property: og:description
      content: Example SQL queries for analyzing documentation usage data collected by Do11y in Supabase.
---

# Queries

Example SQL queries for analyzing the data Do11y stores in Supabase. Events live in the `do11y_events` table with a `payload jsonb` column. You can run these via the Supabase SQL Editor or any PostgreSQL client.

PostgreSQL's JSONB operators extract fields from the payload: `payload->>'field'` returns text, and you cast to the appropriate type when needed (e.g. `::numeric`, `::boolean`, `::timestamptz`).

## Traffic and discovery

### Entry points

Find the most common first pages users land on.

```sql
select payload->>'path' as path, count(*) as entries
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
group by 1
order by entries desc
limit 20
```

### Traffic sources

See where your visitors come from.

```sql
select payload->>'referrerDomain' as "referrerDomain", count(*) as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
group by 1
order by sessions desc
```

### Entry point by referrer

Understand which sources land on which pages.

```sql
select
    payload->>'referrerDomain' as "referrerDomain",
    payload->>'path' as path,
    count(*) as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
group by 1, 2
order by sessions desc
limit 30
```

### AI traffic overview

See how much of your documentation traffic comes from AI platforms.

```sql
select
    count(*) as total,
    count(*) filter (where payload->>'referrerCategory' = 'ai') as "aiSessions",
    count(*) filter (where payload->>'referrerCategory' = 'search-engine') as "searchSessions",
    count(*) filter (where payload->>'referrerCategory' = 'direct') as "directSessions",
    count(*) filter (where payload->>'referrerCategory' = 'social') as "socialSessions",
    count(*) filter (where payload->>'referrerCategory' = 'community') as "communitySessions",
    count(*) filter (where payload->>'referrerCategory' = 'code-host') as "codeHostSessions",
    count(*) filter (where payload->>'referrerCategory' = 'other') as "otherSessions",
    round(100.0 * count(*) filter (where payload->>'referrerCategory' = 'ai') / count(*), 1) as "aiPct"
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
```

### AI traffic by platform

Break down AI traffic by platform (ChatGPT, Perplexity, Claude, etc.).

```sql
select payload->>'aiPlatform' as "aiPlatform", count(*) as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
  and payload->>'referrerCategory' = 'ai'
group by 1
order by sessions desc
```

### AI traffic trend

Track AI-referred sessions over time.

```sql
select
    date_trunc('week', (payload->>'_time')::timestamptz) as week,
    count(*) as total,
    count(*) filter (where payload->>'referrerCategory' = 'ai') as ai,
    round(100.0 * count(*) filter (where payload->>'referrerCategory' = 'ai') / count(*), 1) as "aiPct"
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
group by 1
order by week asc
```

### Pages discovered via AI

Find which documentation pages AI platforms link to most.

```sql
select
    payload->>'path' as path,
    payload->>'aiPlatform' as "aiPlatform",
    count(*) as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
  and payload->>'referrerCategory' = 'ai'
group by 1, 2
order by sessions desc
limit 30
```

### AI vs non-AI engagement

Compare engagement depth for AI-referred visitors vs other sources.

```sql
select
    payload->>'referrerCategory' as "referrerCategory",
    count(*) as visits,
    avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll",
    avg((payload->>'engagementRatio')::numeric) as "avgEngagement"
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
order by visits desc
```

### Traffic source breakdown

Summarize traffic by category.

```sql
select payload->>'referrerCategory' as "referrerCategory", count(*) as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
  and (payload->>'isFirstPage')::boolean = true
group by 1
order by sessions desc
```

## Engagement and page performance

### Page engagement score

Combine time, scroll depth, and engagement ratio into a single score.

```sql
select
    path,
    "avgActiveTime",
    "avgEngagement",
    "avgScrollDepth",
    visits,
    ("avgActiveTime" * "avgEngagement" * "avgScrollDepth") / 100 as "engagementScore"
from (
    select
        payload->>'path' as path,
        avg((payload->>'activeTimeSeconds')::numeric) as "avgActiveTime",
        avg((payload->>'engagementRatio')::numeric) as "avgEngagement",
        avg((payload->>'maxScrollDepth')::numeric) as "avgScrollDepth",
        count(*) as visits
    from do11y_events
    where payload->>'eventType' = 'page_exit'
    group by 1
    having count(*) > 10
) sub
order by "engagementScore" desc
```

### Scroll completion rate

Find pages where users read to the end.

```sql
select
    path,
    total,
    completed,
    round(100.0 * completed / total, 1) as "completionRate"
from (
    select
        payload->>'path' as path,
        count(*) as total,
        count(*) filter (where (payload->>'maxScrollDepth')::numeric >= 90) as completed
    from do11y_events
    where payload->>'eventType' = 'page_exit'
    group by 1
    having count(*) > 10
) sub
order by "completionRate" desc
```

### Bounce detection

Identify pages with high bounce rates (low scroll, low time).

```sql
select
    payload->>'path' as path,
    avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll",
    count(*) as visits
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
having count(*) > 5
  and avg((payload->>'activeTimeSeconds')::numeric) < 10
  and avg((payload->>'maxScrollDepth')::numeric) < 25
order by visits desc
```

## Where users get stuck

### Exit pages

Find where sessions end (excluding single-page sessions).

```sql
select "lastPage", count(*) as exits
from (
    select
        pages[array_length(pages, 1)] as "lastPage",
        pages[1] as "firstPage"
    from (
        select
            payload->>'sessionId' as "sessionId",
            array_agg(payload->>'path' order by (payload->>'_time')::timestamptz) as pages
        from do11y_events
        where payload->>'eventType' = 'page_view'
        group by 1
        having count(*) > 1
    ) sessions
) sub
where "firstPage" != "lastPage"
group by 1
order by exits desc
limit 20
```

### Low engagement pages

Find high-traffic pages with poor engagement.

```sql
select
    payload->>'path' as path,
    count(*) as visits,
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll",
    avg((payload->>'activeTimeSeconds')::numeric) as "avgTime"
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
having count(*) > 20
  and avg((payload->>'maxScrollDepth')::numeric) < 30
order by visits desc
```

### Pages with high search rate

Identify pages where users frequently open search (a potential confusion signal).

```sql
select
    path,
    "totalViews",
    "sessionsWithSearch",
    round(100.0 * "sessionsWithSearch" / "totalViews", 1) as "searchRate"
from (
    select
        path,
        sum("pageViews") as "totalViews",
        count(*) filter (where searches > 0) as "sessionsWithSearch"
    from (
        select
            payload->>'sessionId' as "sessionId",
            payload->>'path' as path,
            count(*) filter (where payload->>'eventType' = 'page_view') as "pageViews",
            count(*) filter (where payload->>'eventType' = 'search_opened') as searches
        from do11y_events
        group by 1, 2
        having count(*) filter (where payload->>'eventType' = 'page_view') > 0
    ) per_session
    group by path
    having sum("pageViews") > 10
) per_page
order by "searchRate" desc
```

## Navigation patterns

### Page-to-page transitions

See how users move between pages.

```sql
select
    payload->>'previousPath' as "previousPath",
    payload->>'path' as path,
    count(*) as transitions
from do11y_events
where payload->>'eventType' = 'page_view'
  and payload->>'previousPath' is not null
group by 1, 2
having count(*) > 5
order by transitions desc
limit 50
```

### Journey depth distribution

Understand how many pages users view per session.

```sql
select
    count(*) as sessions,
    avg("pageCount") as "avgPages",
    percentile_cont(0.5) within group (order by "pageCount") as "medianPages",
    percentile_cont(0.9) within group (order by "pageCount") as "p90Pages"
from (
    select payload->>'sessionId' as "sessionId", count(*) as "pageCount"
    from do11y_events
    where payload->>'eventType' = 'page_view'
    group by 1
) sub
```

### Full session journeys

View complete page sequences for multi-page sessions.

```sql
select
    "sessionId",
    journey,
    array_length(journey, 1) as "journeyLength"
from (
    select
        payload->>'sessionId' as "sessionId",
        array_agg(payload->>'path' order by (payload->>'_time')::timestamptz) as journey
    from do11y_events
    where payload->>'eventType' = 'page_view'
    group by 1
    having count(*) >= 3
) sub
limit 100
```

## Link and CTA performance

### Most clicked links

Find the most popular links across all pages.

```sql
select
    payload->>'linkText' as "linkText",
    payload->>'targetUrl' as "targetUrl",
    count(*) as clicks
from do11y_events
where payload->>'eventType' = 'link_click'
group by 1, 2
order by clicks desc
limit 30
```

### External link destinations

See where users go when they leave.

```sql
select payload->>'targetUrl' as "targetUrl", count(*) as clicks
from do11y_events
where payload->>'eventType' = 'link_click'
  and payload->>'linkType' = 'external'
group by 1
order by clicks desc
```

### Link clicks by section

Track specific CTAs (like "Run in Playground") by page and section.

```sql
select
    payload->>'path' as path,
    payload->>'linkSection' as "linkSection",
    count(*) as clicks
from do11y_events
where payload->>'eventType' = 'link_click'
  and payload->>'linkText' like '%Playground%'
group by 1, 2
order by clicks desc
```

### Pages with low link engagement

Find pages where users don't click links.

```sql
select
    path,
    views,
    "linkClicks",
    round(100.0 * "linkClicks" / views, 1) as "clickRate"
from (
    select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'page_view') as views,
        count(*) filter (where payload->>'eventType' = 'link_click') as "linkClicks"
    from do11y_events
    group by 1
    having count(*) filter (where payload->>'eventType' = 'page_view') > 20
) sub
order by "clickRate" asc
```

## Code block engagement

### Code copy rate by language

See which code languages users copy most.

```sql
select payload->>'language' as language, count(*) as copies
from do11y_events
where payload->>'eventType' = 'code_copied'
group by 1
order by copies desc
```

### Code copies by page

Find pages with the most code block engagement.

```sql
select
    payload->>'path' as path,
    payload->>'codeSection' as "codeSection",
    count(*) as copies
from do11y_events
where payload->>'eventType' = 'code_copied'
group by 1, 2
order by copies desc
limit 30
```

## Section reading patterns

### Most-read sections

Find which headings users actually spend time reading.

```sql
select
    payload->>'path' as path,
    payload->>'heading' as heading,
    count(distinct payload->>'sessionId') as readers,
    avg((payload->>'visibleSeconds')::numeric) as "avgDwell"
from do11y_events
where payload->>'eventType' = 'section_visible'
group by 1, 2
order by readers desc
limit 30
```

### Skipped sections

Identify sections that users scroll past without reading.

```sql
select
    payload->>'path' as path,
    payload->>'heading' as heading,
    count(distinct payload->>'sessionId') as readers,
    avg((payload->>'visibleSeconds')::numeric) as "avgDwell"
from do11y_events
where payload->>'eventType' = 'section_visible'
group by 1, 2
having avg((payload->>'visibleSeconds')::numeric) < 5
order by readers desc
```

## Tab switch patterns

### Most switched-to tabs

See which code language or framework tabs users select.

```sql
select payload->>'tabLabel' as "tabLabel", count(*) as switches
from do11y_events
where payload->>'eventType' = 'tab_switch'
  and (payload->>'isDefault')::boolean = false
group by 1
order by switches desc
```

### Tab switches by page

Understand audience preferences on specific pages.

```sql
select
    payload->>'path' as path,
    payload->>'tabLabel' as "tabLabel",
    payload->>'tabGroup' as "tabGroup",
    count(*) as switches
from do11y_events
where payload->>'eventType' = 'tab_switch'
group by 1, 2, 3
order by switches desc
limit 30
```

## Table of contents usage

### Most clicked TOC entries

Find the headings users jump to via the on-page TOC.

```sql
select
    payload->>'path' as path,
    payload->>'heading' as heading,
    count(*) as clicks
from do11y_events
where payload->>'eventType' = 'toc_click'
group by 1, 2
order by clicks desc
limit 30
```

### Pages with heavy TOC usage

Identify pages where users rely on the TOC (a potential signal that the page is too long or poorly organized).

```sql
select
    path,
    "tocClicks",
    views,
    round(100.0 * "tocClicks" / views, 1) as "tocRate"
from (
    select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'toc_click') as "tocClicks",
        count(*) filter (where payload->>'eventType' = 'page_view') as views
    from do11y_events
    where payload->>'eventType' in ('toc_click', 'page_view')
    group by 1
    having count(*) filter (where payload->>'eventType' = 'page_view') > 10
) sub
order by "tocRate" desc
```

## User feedback

### Feedback by page

See which pages get the best and worst ratings.

```sql
select
    path,
    total,
    helpful,
    "notHelpful",
    round(helpful * 100.0 / total, 1) as "helpfulPct"
from (
    select
        payload->>'path' as path,
        count(*) as total,
        count(*) filter (where payload->>'rating' = 'yes') as helpful,
        count(*) filter (where payload->>'rating' = 'no') as "notHelpful"
    from do11y_events
    where payload->>'eventType' = 'feedback'
    group by 1
    having count(*) >= 3
) sub
order by "helpfulPct" asc
```

## Expand/collapse patterns

### Most expanded sections

Find the `<details>` and accordion content users most want to see.

```sql
select
    payload->>'path' as path,
    payload->>'summary' as summary,
    count(*) as expansions
from do11y_events
where payload->>'eventType' = 'expand_collapse'
  and payload->>'action' = 'expand'
group by 1, 2
order by expansions desc
limit 30
```

### Expand rate by page

Identify pages where users frequently expand hidden content.

```sql
select
    path,
    expands,
    views,
    round(100.0 * expands / views, 1) as "expandRate"
from (
    select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'expand_collapse' and payload->>'action' = 'expand') as expands,
        count(*) filter (where payload->>'eventType' = 'page_view') as views
    from do11y_events
    where payload->>'eventType' in ('expand_collapse', 'page_view')
    group by 1
    having count(*) filter (where payload->>'eventType' = 'page_view') > 10
) sub
order by "expandRate" desc
```

## Content performance comparison

### Page performance dashboard

View all page metrics in a single query.

```sql
select
    path,
    "pageViews",
    "avgScrollDepth",
    "avgTimeSeconds",
    "linkClicks",
    "codeCopies",
    searches,
    "tocClicks",
    expands,
    round(1.0 * "linkClicks" / "pageViews", 2) as "clicksPerView",
    round(1.0 * "codeCopies" / "pageViews", 2) as "copiesPerView"
from (
    select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'page_view') as "pageViews",
        avg((payload->>'maxScrollDepth')::numeric) filter (where payload->>'eventType' = 'page_exit') as "avgScrollDepth",
        avg((payload->>'activeTimeSeconds')::numeric) filter (where payload->>'eventType' = 'page_exit') as "avgTimeSeconds",
        count(*) filter (where payload->>'eventType' = 'link_click') as "linkClicks",
        count(*) filter (where payload->>'eventType' = 'code_copied') as "codeCopies",
        count(*) filter (where payload->>'eventType' = 'search_opened') as searches,
        count(*) filter (where payload->>'eventType' = 'toc_click') as "tocClicks",
        count(*) filter (where payload->>'eventType' = 'expand_collapse') as expands
    from do11y_events
    group by 1
    having count(*) filter (where payload->>'eventType' = 'page_view') > 10
) sub
order by "pageViews" desc
```

### Compare sections

Aggregate performance by URL prefix (section).

```sql
select
    substring(payload->>'path' from '^/([^/]+)') as section,
    count(*) as visits,
    avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
order by visits desc
```

### Week-over-week trend

Track traffic growth over time.

```sql
select
    date_trunc('week', (payload->>'_time')::timestamptz) as week,
    count(*) as "pageViews",
    count(distinct payload->>'sessionId') as "uniqueSessions"
from do11y_events
where payload->>'eventType' = 'page_view'
group by 1
order by week asc
```

## Device and context

### Mobile vs desktop engagement

Compare engagement by device type.

```sql
select
    payload->>'deviceType' as "deviceType",
    count(*) as visits,
    avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
```

### Viewport impact on engagement

See how screen size affects user behavior.

```sql
select
    payload->>'viewportCategory' as "viewportCategory",
    count(*) as visits,
    avg((payload->>'maxScrollDepth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventType' = 'page_exit'
group by 1
order by visits desc
```

### Browser breakdown

Understand your audience's browser preferences.

```sql
select payload->>'browserFamily' as "browserFamily", count(distinct payload->>'sessionId') as sessions
from do11y_events
where payload->>'eventType' = 'page_view'
group by 1
order by sessions desc
```

## Key metrics reference

| Metric | Good signal | Warning signal |
|---|---|---|
| Avg scroll depth | > 60% | < 25% |
| Avg active time | 30–120s | < 10s |
| Completion rate (90% scroll) | > 40% | < 15% |
| Pages per session | > 3 | 1 (bounce) |
| Search rate after page view | Low | High (confusion) |
| Exit rate | Low on guides | High on intro pages |
| TOC click rate | Low (well-organized) | High (page too long) |
| Feedback helpful % | > 80% | < 50% |
| Expand rate | Moderate | Very high (promote content) |
| Section avg dwell | > 10s | < 3s (skipped) |
