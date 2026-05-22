---
name: analyze-do11y-data
description: Query and interpret documentation analytics data collected by Do11y. Use when asked to analyze docs performance, find pages to improve, interpret engagement metrics, investigate user behavior, audit instrumentation quality, or produce optimization recommendations from Do11y data.
---

# Analyze Do11y data

## Setup

Ask for these credentials if not already provided:

- **Datasource** — Tinybird datasource name
- **Token** — Tinybird read token
- **Host** — Tinybird API host (default: `api.tinybird.co`)
- **Time range** — default last 90 days

## Running queries

```bash
curl -s "https://HOST/v0/sql?q=QUERY" \
  -H "Authorization: Bearer TOKEN"
```

Results are returned as JSON with a `data` array of row objects.

## Analysis workflow

Run these queries in parallel for a full audit. All use the datasource name provided.

### 1. Section-level traffic and engagement

```sql
SELECT
  extract(path, '^/docs/([^/]+)') as section,
  count() as visits,
  avg(activeTimeSeconds) as avgTime,
  avg(maxScrollDepth) as avgScroll
FROM DATASOURCE
WHERE eventType = 'page_exit'
GROUP BY section
ORDER BY visits DESC
```

### 2. Top entry points

```sql
SELECT path, count() as entries
FROM DATASOURCE
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY path
ORDER BY entries DESC
LIMIT 25
```

### 3. High search rate — confusion signal

```sql
SELECT path,
  countIf(eventType = 'page_view') as pageViews,
  countIf(eventType = 'search_opened') as searches,
  round(100.0 * countIf(eventType = 'search_opened') / countIf(eventType = 'page_view'), 1) as searchRate
FROM DATASOURCE
GROUP BY path
HAVING pageViews > 10
ORDER BY searchRate DESC
LIMIT 20
```

### 4. Bounce detection

```sql
SELECT path,
  avg(activeTimeSeconds) as avgTime,
  avg(maxScrollDepth) as avgScroll,
  count() as visits
FROM DATASOURCE
WHERE eventType = 'page_exit'
GROUP BY path
HAVING visits > 5 AND avgTime < 10 AND avgScroll < 25
ORDER BY visits DESC
```

### 5. High-traffic, low-engagement pages

```sql
SELECT path,
  count() as visits,
  avg(maxScrollDepth) as avgScroll,
  avg(activeTimeSeconds) as avgTime
FROM DATASOURCE
WHERE eventType = 'page_exit'
GROUP BY path
HAVING visits > 20 AND avgScroll < 30
ORDER BY visits DESC
```

### 6. Scroll completion rate

```sql
SELECT path,
  count() as total,
  countIf(maxScrollDepth >= 90) as completed,
  round(100.0 * countIf(maxScrollDepth >= 90) / count(), 1) as completionRate
FROM DATASOURCE
WHERE eventType = 'page_exit'
GROUP BY path
HAVING total > 10
ORDER BY completionRate DESC
LIMIT 20
```

### 7. TOC heavy usage — page length / organization signal

```sql
SELECT path,
  countIf(eventType = 'toc_click') as tocClicks,
  countIf(eventType = 'page_view') as views,
  round(100.0 * countIf(eventType = 'toc_click') / countIf(eventType = 'page_view'), 1) as tocRate
FROM DATASOURCE
WHERE eventType IN ('toc_click', 'page_view')
GROUP BY path
HAVING views > 10
ORDER BY tocRate DESC
LIMIT 20
```

### 8. Tab switch preferences

```sql
SELECT tabLabel, count() as switches
FROM DATASOURCE
WHERE eventType = 'tab_switch' AND isDefault = false
GROUP BY tabLabel
ORDER BY switches DESC
LIMIT 20
```

### 9. Feedback by page

```sql
SELECT path,
  count() as total,
  countIf(rating = 'yes') as helpful,
  countIf(rating = 'no') as notHelpful,
  round(countIf(rating = 'yes') * 100.0 / count(), 1) as helpfulPct
FROM DATASOURCE
WHERE eventType = 'feedback'
GROUP BY path
HAVING total >= 3
ORDER BY helpfulPct ASC
```

### 10. Traffic sources

```sql
SELECT referrerCategory, count() as sessions
FROM DATASOURCE
WHERE eventType = 'page_view' AND isFirstPage = true
GROUP BY referrerCategory
ORDER BY sessions DESC
```

## Instrumentation health checks

After running the audit queries, check for these common gaps:

| Check | How to spot it | Likely cause |
|---|---|---|
| Referrer tracking blind | > 90% null `referrerCategory` | Referrer classification not running before first `page_view` fires |
| Code language unknown | > 90% `language: "unknown"` in `code_copied` events | `language` attribute not read from code block's CSS class |
| TOC clicks near zero | Zero or near-zero `toc_click` events despite traffic | TOC element selector doesn't match site markup |
| Section dwell all identical | Every row returns the same `visibleSeconds` | IntersectionObserver timer resetting on visibility change rather than accumulating |
| No feedback events | Zero `feedback` events despite traffic | Feedback widget not rendered or selector not matched |

Flag any instrumentation gaps at the top of the report before interpreting content metrics — they affect which findings are reliable.

## Interpreting results

| Metric | Good | Warning |
|---|---|---|
| Avg scroll depth | > 60% | < 25% |
| Avg active time | 30–120s | < 10s |
| Scroll completion (90%+) | > 40% | < 15% |
| Search rate after landing | Low | > 5% (confusion signal) |
| TOC click rate | < 5% | > 15% (page too long or poorly organized) |
| Feedback helpful % | > 80% | < 50% |
| Pages per session | > 3 | 1 (bounce) |

High search rate on a page = users arrived with intent the page doesn't fulfill. High TOC rate = users are hunting for a section, suggesting the page is too long or its headings are unclear. High exit rate on a page that is also a top entry point = the page is a dead end.

Use pages with scroll completion > 50% as structural templates for rewrites.

## Report structure

Organize output into these sections:

1. **Instrumentation gaps** — note any of the health checks above that failed; flag which downstream findings are affected
2. **Traffic overview** — top entry points, section volumes, traffic source breakdown
3. **Engagement problems** — high-traffic/low-scroll pages; bounce candidates
4. **Confusion signals** — high search-rate pages; heavy TOC usage pages
5. **High-performing content** — high completion rate pages; sections with strong dwell — use as rewrite templates
6. **Routing issues** — paths missing expected prefix; suspected 404s (near-zero engagement, no scroll)
7. **Prioritised actions**:
   - **Immediate** — content changes (copy, navigation, structure)
   - **Short-term** — redirects and routing fixes
   - **Instrumentation** — Do11y tracking gaps

For each finding, cite the specific pages affected, the metric values vs threshold, and a concrete change linked to the page's file path in the docs repo where possible.
