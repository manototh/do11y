---
title: Queries
description: Example SQL queries for analyzing documentation usage data collected by Do11y in Tinybird.
head:
  - - meta
    - property: og:title
      content: Queries — Do11y
  - - meta
    - property: og:description
      content: Example SQL queries for analyzing documentation usage data collected by Do11y in Tinybird.
---

# Queries

Example SQL queries for analyzing the data Do11y sends to Tinybird. Replace `do11y` with your datasource name in each query. You can run these via the Tinybird SQL API or in the Tinybird UI.

Tinybird uses ClickHouse SQL. For more on the query syntax, see the [ClickHouse SQL reference](https://clickhouse.com/docs/en/sql-reference).

## Traffic and discovery

### Entry points

Find the most common first pages users land on.

```sql
SELECT path, count() AS entries
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY path
ORDER BY entries DESC
LIMIT 20
```

### Traffic sources

See where your visitors come from.

```sql
SELECT referrerDomain, count() AS sessions
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY referrerDomain
ORDER BY sessions DESC
```

### Entry point by referrer

Understand which sources land on which pages.

```sql
SELECT referrerDomain, path, count() AS sessions
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY referrerDomain, path
ORDER BY sessions DESC
LIMIT 30
```

### AI traffic overview

See how much of your documentation traffic comes from AI platforms.

```sql
SELECT
    count() AS total,
    countIf(referrerCategory = 'ai') AS aiSessions,
    countIf(referrerCategory = 'search-engine') AS searchSessions,
    countIf(referrerCategory = 'direct') AS directSessions,
    countIf(referrerCategory = 'social') AS socialSessions,
    countIf(referrerCategory = 'community') AS communitySessions,
    countIf(referrerCategory = 'code-host') AS codeHostSessions,
    countIf(referrerCategory = 'other') AS otherSessions,
    round(100.0 * aiSessions / total, 1) AS aiPct
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
```

### AI traffic by platform

Break down AI traffic by platform (ChatGPT, Perplexity, Claude, etc.).

```sql
SELECT aiPlatform, count() AS sessions
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true AND referrerCategory = 'ai'
GROUP BY aiPlatform
ORDER BY sessions DESC
```

### AI traffic trend

Track AI-referred sessions over time.

```sql
SELECT
    toStartOfWeek(_time) AS week,
    count() AS total,
    countIf(referrerCategory = 'ai') AS ai,
    round(100.0 * ai / total, 1) AS aiPct
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY week
ORDER BY week ASC
```

### Pages discovered via AI

Find which documentation pages AI platforms link to most.

```sql
SELECT path, aiPlatform, count() AS sessions
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true AND referrerCategory = 'ai'
GROUP BY path, aiPlatform
ORDER BY sessions DESC
LIMIT 30
```

### AI vs non-AI engagement

Compare engagement depth for AI-referred visitors vs other sources.

```sql
SELECT
    referrerCategory,
    count() AS visits,
    avg(activeTimeSeconds) AS avgTime,
    avg(maxScrollDepth) AS avgScroll,
    avg(engagementRatio) AS avgEngagement
FROM do11y
WHERE eventType = 'page_exit'
GROUP BY referrerCategory
ORDER BY visits DESC
```

### Traffic source breakdown

Summarize traffic by category.

```sql
SELECT referrerCategory, count() AS sessions
FROM do11y
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY referrerCategory
ORDER BY sessions DESC
```

## Engagement and page performance

### Page engagement score

Combine time, scroll depth, and engagement ratio into a single score.

```sql
SELECT
    path,
    avg(activeTimeSeconds) AS avgActiveTime,
    avg(engagementRatio) AS avgEngagement,
    avg(maxScrollDepth) AS avgScrollDepth,
    count() AS visits,
    (avgActiveTime * avgEngagement * avgScrollDepth) / 100 AS engagementScore
FROM do11y
WHERE eventType = 'page_exit'
GROUP BY path
HAVING visits > 10
ORDER BY engagementScore DESC
```

### Scroll completion rate

Find pages where users read to the end.

```sql
SELECT
    path,
    count() AS total,
    countIf(maxScrollDepth >= 90) AS completed,
    round(100.0 * completed / total, 1) AS completionRate
FROM do11y
WHERE eventType = 'page_exit'
GROUP BY path
HAVING total > 10
ORDER BY completionRate DESC
```

### Bounce detection

Identify pages with high bounce rates (low scroll, low time).

```sql
SELECT
    path,
    avg(activeTimeSeconds) AS avgTime,
    avg(maxScrollDepth) AS avgScroll,
    count() AS visits
FROM do11y
WHERE eventType = 'page_exit'
GROUP BY path
HAVING visits > 5 AND avgTime < 10 AND avgScroll < 25
ORDER BY visits DESC
```

## Where users get stuck

### Exit pages

Find where sessions end (excluding single-page sessions).

```sql
SELECT
    toString(pages[length(pages)]) AS lastPage,
    count() AS exits
FROM (
    SELECT
        sessionId,
        groupArray(path) AS pages
    FROM (
        SELECT sessionId, path
        FROM do11y
        WHERE eventType = 'page_view'
        ORDER BY _time ASC
    )
    GROUP BY sessionId
    HAVING length(pages) > 1
)
WHERE toString(pages[1]) != lastPage
GROUP BY lastPage
ORDER BY exits DESC
LIMIT 20
```

### Low engagement pages

Find high-traffic pages with poor engagement.

```sql
SELECT
    path,
    count() AS visits,
    avg(maxScrollDepth) AS avgScroll,
    avg(activeTimeSeconds) AS avgTime
FROM do11y
WHERE eventType = 'page_exit'
GROUP BY path
HAVING visits > 20 AND avgScroll < 30
ORDER BY visits DESC
```

### Pages with high search rate

Identify pages where users frequently open search (a potential confusion signal).

```sql
SELECT
    path,
    sum(pageViews) AS totalViews,
    countIf(searches > 0) AS sessionsWithSearch,
    round(100.0 * sessionsWithSearch / totalViews, 1) AS searchRate
FROM (
    SELECT
        sessionId,
        path,
        countIf(eventType = 'page_view') AS pageViews,
        countIf(eventType = 'search_opened') AS searches
    FROM do11y
    GROUP BY sessionId, path
    HAVING pageViews > 0
)
GROUP BY path
HAVING totalViews > 10
ORDER BY searchRate DESC
```

## Navigation patterns

### Page-to-page transitions

See how users move between pages.

```sql
SELECT previousPath, path, count() AS transitions
FROM do11y
WHERE eventType = 'page_view' AND previousPath IS NOT NULL
GROUP BY previousPath, path
HAVING transitions > 5
ORDER BY transitions DESC
LIMIT 50
```

### Journey depth distribution

Understand how many pages users view per session.

```sql
SELECT
    count() AS sessions,
    avg(pageCount) AS avgPages,
    quantile(0.5)(pageCount) AS medianPages,
    quantile(0.9)(pageCount) AS p90Pages
FROM (
    SELECT sessionId, count() AS pageCount
    FROM do11y
    WHERE eventType = 'page_view'
    GROUP BY sessionId
)
```

### Full session journeys

View complete page sequences for multi-page sessions.

```sql
SELECT
    sessionId,
    groupArray(path) AS journey,
    length(journey) AS journeyLength
FROM (
    SELECT sessionId, path
    FROM do11y
    WHERE eventType = 'page_view'
    ORDER BY _time ASC
)
GROUP BY sessionId
HAVING journeyLength >= 3
LIMIT 100
```

## Link and CTA performance

### Most clicked links

Find the most popular links across all pages.

```sql
SELECT linkText, targetUrl, count() AS clicks
FROM do11y
WHERE eventType = 'link_click'
GROUP BY linkText, targetUrl
ORDER BY clicks DESC
LIMIT 30
```

### External link destinations

See where users go when they leave.

```sql
SELECT targetUrl, count() AS clicks
FROM do11y
WHERE eventType = 'link_click' AND linkType = 'external'
GROUP BY targetUrl
ORDER BY clicks DESC
```

### Link clicks by section

Track specific CTAs (like "Run in Playground") by page and section.

```sql
SELECT path, linkSection, count() AS clicks
FROM do11y
WHERE eventType = 'link_click' AND linkText LIKE '%Playground%'
GROUP BY path, linkSection
ORDER BY clicks DESC
```

### Pages with low link engagement

Find pages where users don't click links.

```sql
SELECT
    path,
    countIf(eventType = 'page_view') AS views,
    countIf(eventType = 'link_click') AS linkClicks,
    round(100.0 * linkClicks / views, 1) AS clickRate
FROM do11y
GROUP BY path
HAVING views > 20
ORDER BY clickRate ASC
```

## Code block engagement

### Code copy rate by language

See which code languages users copy most.

```sql
SELECT language, count() AS copies
FROM do11y
WHERE eventType = 'code_copied'
GROUP BY language
ORDER BY copies DESC
```

### Code copies by page

Find pages with the most code block engagement.

```sql
SELECT path, codeSection, count() AS copies
FROM do11y
WHERE eventType = 'code_copied'
GROUP BY path, codeSection
ORDER BY copies DESC
LIMIT 30
```

## Section reading patterns

### Most-read sections

Find which headings users actually spend time reading.

```sql
SELECT
    path,
    heading,
    uniq(sessionId) AS readers,
    avg(visibleSeconds) AS avgDwell
FROM do11y
WHERE eventType = 'section_visible'
GROUP BY path, heading
ORDER BY readers DESC
LIMIT 30
```

### Skipped sections

Identify sections that users scroll past without reading.

```sql
SELECT
    path,
    heading,
    uniq(sessionId) AS readers,
    avg(visibleSeconds) AS avgDwell
FROM do11y
WHERE eventType = 'section_visible'
GROUP BY path, heading
HAVING avgDwell < 5
ORDER BY readers DESC
```

## Tab switch patterns

### Most switched-to tabs

See which code language or framework tabs users select.

```sql
SELECT tabLabel, count() AS switches
FROM do11y
WHERE eventType = 'tab_switch' AND isDefault = false
GROUP BY tabLabel
ORDER BY switches DESC
```

### Tab switches by page

Understand audience preferences on specific pages.

```sql
SELECT path, tabLabel, tabGroup, count() AS switches
FROM do11y
WHERE eventType = 'tab_switch'
GROUP BY path, tabLabel, tabGroup
ORDER BY switches DESC
LIMIT 30
```

## Table of contents usage

### Most clicked TOC entries

Find the headings users jump to via the on-page TOC.

```sql
SELECT path, heading, count() AS clicks
FROM do11y
WHERE eventType = 'toc_click'
GROUP BY path, heading
ORDER BY clicks DESC
LIMIT 30
```

### Pages with heavy TOC usage

Identify pages where users rely on the TOC (a potential signal that the page is too long or poorly organized).

```sql
SELECT
    path,
    countIf(eventType = 'toc_click') AS tocClicks,
    countIf(eventType = 'page_view') AS views,
    round(100.0 * tocClicks / views, 1) AS tocRate
FROM do11y
WHERE eventType IN ('toc_click', 'page_view')
GROUP BY path
HAVING views > 10
ORDER BY tocRate DESC
```

## User feedback

### Feedback by page

See which pages get the best and worst ratings.

```sql
SELECT
    path,
    count() AS total,
    countIf(rating = 'yes') AS helpful,
    countIf(rating = 'no') AS notHelpful,
    round(helpful * 100.0 / total, 1) AS helpfulPct
FROM do11y
WHERE eventType = 'feedback'
GROUP BY path
HAVING total >= 3
ORDER BY helpfulPct ASC
```

## Expand/collapse patterns

### Most expanded sections

Find the `<details>` and accordion content users most want to see.

```sql
SELECT path, summary, count() AS expansions
FROM do11y
WHERE eventType = 'expand_collapse' AND action = 'expand'
GROUP BY path, summary
ORDER BY expansions DESC
LIMIT 30
```

### Expand rate by page

Identify pages where users frequently expand hidden content.

```sql
SELECT
    path,
    countIf(eventType = 'expand_collapse' AND action = 'expand') AS expands,
    countIf(eventType = 'page_view') AS views,
    round(100.0 * expands / views, 1) AS expandRate
FROM do11y
WHERE eventType IN ('expand_collapse', 'page_view')
GROUP BY path
HAVING views > 10
ORDER BY expandRate DESC
```

## Content performance comparison

### Page performance dashboard

View all page metrics in a single query.

```apl
['do11y']
| summarize 
    pageViews = countif(eventType == 'page_view'),
    avgScrollDepth = avgif(maxScrollDepth, eventType == 'page_exit'),
    avgTimeSeconds = avgif(activeTimeSeconds, eventType == 'page_exit'),
    linkClicks = countif(eventType == 'link_click'),
    codeCopies = countif(eventType == 'code_copied'),
    searches = countif(eventType == 'search_opened'),
    tocClicks = countif(eventType == 'toc_click'),
    expands = countif(eventType == 'expand_collapse')
  by path
| where pageViews > 10
| extend 
    clicksPerView = round(1.0 * linkClicks / pageViews, 2),
    copiesPerView = round(1.0 * codeCopies / pageViews, 2)
| order by pageViews desc
```

### Compare sections

Aggregate performance by URL prefix (section).

```apl
['do11y']
| extend section = extract("^/([^/]+)", 1, path)
| where eventType == 'page_exit'
| summarize 
    visits = count(),
    avgTime = avg(activeTimeSeconds),
    avgScroll = avg(maxScrollDepth)
  by section
| order by visits desc
```

### Week-over-week trend

Track traffic growth over time.

```apl
['do11y']
| where eventType == 'page_view'
| extend week = startofweek(_time)
| summarize pageViews = count(), uniqueSessions = dcount(sessionId) by bin_auto(_time), week
| order by week asc
```

## Device and context

### Mobile vs desktop engagement

Compare engagement by device type.

```apl
['do11y']
| where eventType == 'page_exit'
| summarize 
    visits = count(),
    avgTime = avg(activeTimeSeconds),
    avgScroll = avg(maxScrollDepth)
  by deviceType
```

### Viewport impact on engagement

See how screen size affects user behavior.

```apl
['do11y']
| where eventType == 'page_exit'
| summarize 
    visits = count(),
    avgScroll = avg(maxScrollDepth)
  by viewportCategory
| order by visits desc
```

### Browser breakdown

Understand your audience's browser preferences.

```apl
['do11y']
| where eventType == 'page_view'
| summarize sessions = dcount(sessionId) by browserFamily
| order by sessions desc
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
