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

PostgreSQL's JSONB operators extract fields from the payload: `payload->>'field'` returns text, and you cast to the appropriate type when needed (for example, `::numeric`, `::boolean`, `::timestamptz`).

All field names follow [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/). Event names use the `browser.do11y.*` namespace (e.g., `browser.do11y.page_view`) and attribute keys use OTel standard names where available (`session.id`, `url.path`, `device.type`).

## Traffic and discovery

### Entry points

Find the most common first pages users land on.

```sql
select payload->>'url.path' as path, count(*) as entries
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1
order by entries desc
limit 20
```

### Traffic sources

See where your visitors come from.

```sql
select payload->>'browser.do11y.referrer_domain' as "referrerDomain", count(*) as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1
order by sessions desc
```

### Entry point by referrer

Understand which sources land on which pages.

```sql
select
    payload->>'browser.do11y.referrer_domain' as "referrerDomain",
    payload->>'url.path' as path,
    count(*) as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1, 2
order by sessions desc
limit 30
```

### AI traffic overview

See how much of your documentation traffic comes from AI platforms.

```sql
select
    count(*) as total,
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'ai') as "aiSessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'search-engine') as "searchSessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'direct') as "directSessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'social') as "socialSessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'community') as "communitySessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'code-host') as "codeHostSessions",
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'other') as "otherSessions",
    round(100.0 * count(*) filter (where payload->>'browser.do11y.referrer_category' = 'ai') / count(*), 1) as "aiPct"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
```

### AI traffic by platform

Break down AI traffic by platform (ChatGPT, Perplexity, Claude, etc.).

```sql
select payload->>'browser.do11y.ai_platform' as "aiPlatform", count(*) as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
  and payload->>'browser.do11y.referrer_category' = 'ai'
group by 1
order by sessions desc
```

### AI traffic trend

Track AI-referred sessions over time.

```sql
select
    date_trunc('week', (payload->>'_time')::timestamptz) as week,
    count(*) as total,
    count(*) filter (where payload->>'browser.do11y.referrer_category' = 'ai') as ai,
    round(100.0 * count(*) filter (where payload->>'browser.do11y.referrer_category' = 'ai') / count(*), 1) as "aiPct"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1
order by week asc
```

### Pages discovered via AI

Find which documentation pages AI platforms link to most.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.ai_platform' as "aiPlatform",
    count(*) as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
  and payload->>'browser.do11y.referrer_category' = 'ai'
group by 1, 2
order by sessions desc
limit 30
```

### AI vs non-AI engagement

Compare engagement depth for AI-referred visitors vs other sources.

```sql
select
    payload->>'browser.do11y.referrer_category' as "referrerCategory",
    count(*) as visits,
    avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgTime",
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll",
    avg((payload->>'browser.do11y.page_exit.engagement_ratio')::numeric) as "avgEngagement"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
order by visits desc
```

### Traffic source breakdown

Summarize traffic by category.

```sql
select payload->>'browser.do11y.referrer_category' as "referrerCategory", count(*) as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and (payload->>'browser.do11y.is_first_page')::boolean = true
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
        payload->>'url.path' as path,
        avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgActiveTime",
        avg((payload->>'browser.do11y.page_exit.engagement_ratio')::numeric) as "avgEngagement",
        avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScrollDepth",
        count(*) as visits
    from do11y_events
    where payload->>'eventName' = 'browser.do11y.page_exit'
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
        payload->>'url.path' as path,
        count(*) as total,
        count(*) filter (where (payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric >= 90) as completed
    from do11y_events
    where payload->>'eventName' = 'browser.do11y.page_exit'
    group by 1
    having count(*) > 10
) sub
order by "completionRate" desc
```

### Bounce detection

Identify pages with high bounce rates (low scroll, low time).

```sql
select
    payload->>'url.path' as path,
    avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgTime",
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll",
    count(*) as visits
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
having count(*) > 5
  and avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) < 10
  and avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) < 25
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
            payload->>'session.id' as "sessionId",
            array_agg(payload->>'url.path' order by (payload->>'_time')::timestamptz) as pages
        from do11y_events
        where payload->>'eventName' = 'browser.do11y.page_view'
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
    payload->>'url.path' as path,
    count(*) as visits,
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll",
    avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgTime"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
having count(*) > 20
  and avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) < 30
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
            payload->>'session.id' as "sessionId",
            payload->>'url.path' as path,
            count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as "pageViews",
            count(*) filter (where payload->>'eventName' = 'browser.do11y.search_opened') as searches
        from do11y_events
        group by 1, 2
        having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 0
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
    payload->>'browser.do11y.previous_path' as "previousPath",
    payload->>'url.path' as path,
    count(*) as transitions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
  and payload->>'browser.do11y.previous_path' is not null
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
    select payload->>'session.id' as "sessionId", count(*) as "pageCount"
    from do11y_events
    where payload->>'eventName' = 'browser.do11y.page_view'
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
        payload->>'session.id' as "sessionId",
        array_agg(payload->>'url.path' order by (payload->>'_time')::timestamptz) as journey
    from do11y_events
    where payload->>'eventName' = 'browser.do11y.page_view'
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
    payload->>'browser.do11y.link.text' as "linkText",
    payload->>'browser.do11y.link.target_url' as "targetUrl",
    count(*) as clicks
from do11y_events
where payload->>'eventName' = 'browser.do11y.link_click'
group by 1, 2
order by clicks desc
limit 30
```

### External link destinations

See where users go when they leave.

```sql
select payload->>'browser.do11y.link.target_url' as "targetUrl", count(*) as clicks
from do11y_events
where payload->>'eventName' = 'browser.do11y.link_click'
  and payload->>'browser.do11y.link.type' = 'external'
group by 1
order by clicks desc
```

### Link clicks by section

Track specific CTAs (like "Sign up") by page and section.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.link.section' as "linkSection",
    count(*) as clicks
from do11y_events
where payload->>'eventName' = 'browser.do11y.link_click'
  and payload->>'browser.do11y.link.text' like '%Sign up%'
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
        payload->>'url.path' as path,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as views,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.link_click') as "linkClicks"
    from do11y_events
    group by 1
    having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 20
) sub
order by "clickRate" asc
```

## Code block engagement

### Code copy rate by language

See which code languages users copy most.

```sql
select payload->>'browser.do11y.code.language' as language, count(*) as copies
from do11y_events
where payload->>'eventName' = 'browser.do11y.code_copied'
group by 1
order by copies desc
```

### Code copies by page

Find pages with the most code block engagement.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.code.section' as "codeSection",
    count(*) as copies
from do11y_events
where payload->>'eventName' = 'browser.do11y.code_copied'
group by 1, 2
order by copies desc
limit 30
```

## Section reading patterns

### Most-read sections

Find which headings users actually spend time reading.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.section.heading' as heading,
    count(distinct payload->>'session.id') as readers,
    avg((payload->>'browser.do11y.section.visible_seconds')::numeric) as "avgDwell"
from do11y_events
where payload->>'eventName' = 'browser.do11y.section_visible'
group by 1, 2
order by readers desc
limit 30
```

### Skipped sections

Identify sections that users scroll past without reading.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.section.heading' as heading,
    count(distinct payload->>'session.id') as readers,
    avg((payload->>'browser.do11y.section.visible_seconds')::numeric) as "avgDwell"
from do11y_events
where payload->>'eventName' = 'browser.do11y.section_visible'
group by 1, 2
having avg((payload->>'browser.do11y.section.visible_seconds')::numeric) < 5
order by readers desc
```

## Tab switch patterns

### Most switched-to tabs

See which code language or framework tabs users select.

```sql
select payload->>'browser.do11y.tab.label' as "tabLabel", count(*) as switches
from do11y_events
where payload->>'eventName' = 'browser.do11y.tab_switch'
  and (payload->>'browser.do11y.tab.is_default')::boolean = false
group by 1
order by switches desc
```

### Tab switches by page

Understand audience preferences on specific pages.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.tab.label' as "tabLabel",
    payload->>'browser.do11y.tab.group' as "tabGroup",
    count(*) as switches
from do11y_events
where payload->>'eventName' = 'browser.do11y.tab_switch'
group by 1, 2, 3
order by switches desc
limit 30
```

## Table of contents usage

### Most clicked TOC entries

Find the headings users jump to via the on-page TOC.

```sql
select
    payload->>'url.path' as path,
    payload->>'browser.do11y.toc.heading' as heading,
    count(*) as clicks
from do11y_events
where payload->>'eventName' = 'browser.do11y.toc_click'
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
        payload->>'url.path' as path,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.toc_click') as "tocClicks",
        count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as views
    from do11y_events
    where payload->>'eventName' in ('browser.do11y.toc_click', 'browser.do11y.page_view')
    group by 1
    having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 10
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
        payload->>'url.path' as path,
        count(*) as total,
        count(*) filter (where payload->>'browser.do11y.feedback.rating' = 'yes') as helpful,
        count(*) filter (where payload->>'browser.do11y.feedback.rating' = 'no') as "notHelpful"
    from do11y_events
    where payload->>'eventName' = 'browser.do11y.feedback'
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
    payload->>'url.path' as path,
    payload->>'browser.do11y.expand.summary' as summary,
    count(*) as expansions
from do11y_events
where payload->>'eventName' = 'browser.do11y.expand_collapse'
  and payload->>'browser.do11y.expand.action' = 'expand'
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
        payload->>'url.path' as path,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.expand_collapse' and payload->>'browser.do11y.expand.action' = 'expand') as expands,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as views
    from do11y_events
    where payload->>'eventName' in ('browser.do11y.expand_collapse', 'browser.do11y.page_view')
    group by 1
    having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 10
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
        payload->>'url.path' as path,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as "pageViews",
        avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) filter (where payload->>'eventName' = 'browser.do11y.page_exit') as "avgScrollDepth",
        avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) filter (where payload->>'eventName' = 'browser.do11y.page_exit') as "avgTimeSeconds",
        count(*) filter (where payload->>'eventName' = 'browser.do11y.link_click') as "linkClicks",
        count(*) filter (where payload->>'eventName' = 'browser.do11y.code_copied') as "codeCopies",
        count(*) filter (where payload->>'eventName' = 'browser.do11y.search_opened') as searches,
        count(*) filter (where payload->>'eventName' = 'browser.do11y.toc_click') as "tocClicks",
        count(*) filter (where payload->>'eventName' = 'browser.do11y.expand_collapse') as expands
    from do11y_events
    group by 1
    having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 10
) sub
order by "pageViews" desc
```

### Compare sections

Aggregate performance by URL prefix (section).

```sql
select
    substring(payload->>'url.path' from '^/([^/]+)') as section,
    count(*) as visits,
    avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgTime",
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
order by visits desc
```

### Week-over-week trend

Track traffic growth over time.

```sql
select
    date_trunc('week', (payload->>'_time')::timestamptz) as week,
    count(*) as "pageViews",
    count(distinct payload->>'session.id') as "uniqueSessions"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
group by 1
order by week asc
```

## Device and context

### Mobile vs desktop engagement

Compare engagement by device type.

```sql
select
    payload->>'device.type' as "deviceType",
    count(*) as visits,
    avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as "avgTime",
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
```

### Viewport impact on engagement

See how screen size affects user behavior.

```sql
select
    payload->>'browser.do11y.viewport_category' as "viewportCategory",
    count(*) as visits,
    avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as "avgScroll"
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
order by visits desc
```

### Browser breakdown

Understand your audience's browser preferences.

```sql
select payload->>'browser.family' as "browserFamily", count(distinct payload->>'session.id') as sessions
from do11y_events
where payload->>'eventName' = 'browser.do11y.page_view'
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
