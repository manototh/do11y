---
name: analyze-do11y-data
description: Query and interpret documentation analytics data collected by Do11y. Use when asked to analyze docs performance, find pages to improve, interpret engagement metrics, investigate user behavior, audit instrumentation quality, or produce optimization recommendations from Do11y data.
---

# Analyze Do11y data

## Setup

Ask for these credentials if not already provided:

- **Database URL** — Supabase Postgres connection string (from Settings > Database)
- **Table** — Table name (default: `do11y_events`)
- **Time range** — default last 90 days

## Running queries

Connect directly to the Supabase Postgres database using the connection string:

```bash
psql "$DATABASE_URL" -c "SELECT ..."
```

Or use a script with the `pg` package. Events are stored as JSONB in the `payload` column of the `do11y_events` table.

## Analysis workflow

Run these queries in parallel for a full audit.

### 1. Section-level traffic and engagement

```sql
select
  split_part(payload->>'path', '/', 3) as section,
  count(*) as visits,
  avg((payload->>'activeTimeSeconds')::numeric) as avg_time,
  avg((payload->>'maxScrollDepth')::numeric) as avg_scroll
from TABLE
where payload->>'eventType' = 'page_exit'
group by 1
order by visits desc
```

### 2. Top entry points

```sql
select payload->>'path' as path, count(*) as entries
from TABLE
where payload->>'eventType' = 'page_view' and (payload->>'isFirstPage')::boolean = true
group by 1
order by entries desc
limit 25
```

### 3. High search rate — confusion signal

```sql
select
  payload->>'path' as path,
  count(*) filter (where payload->>'eventType' = 'page_view') as page_views,
  count(*) filter (where payload->>'eventType' = 'search_opened') as searches,
  round(100.0 * count(*) filter (where payload->>'eventType' = 'search_opened')
    / count(*) filter (where payload->>'eventType' = 'page_view'), 1) as search_rate
from TABLE
group by 1
having count(*) filter (where payload->>'eventType' = 'page_view') > 10
order by search_rate desc
limit 20
```

### 4. Bounce detection

```sql
select
  payload->>'path' as path,
  avg((payload->>'activeTimeSeconds')::numeric) as avg_time,
  avg((payload->>'maxScrollDepth')::numeric) as avg_scroll,
  count(*) as visits
from TABLE
where payload->>'eventType' = 'page_exit'
group by 1
having count(*) > 5
  and avg((payload->>'activeTimeSeconds')::numeric) < 10
  and avg((payload->>'maxScrollDepth')::numeric) < 25
order by visits desc
```

### 5. High-traffic, low-engagement pages

```sql
select
  payload->>'path' as path,
  count(*) as visits,
  avg((payload->>'maxScrollDepth')::numeric) as avg_scroll,
  avg((payload->>'activeTimeSeconds')::numeric) as avg_time
from TABLE
where payload->>'eventType' = 'page_exit'
group by 1
having count(*) > 20 and avg((payload->>'maxScrollDepth')::numeric) < 30
order by visits desc
```

### 6. Scroll completion rate

```sql
select
  payload->>'path' as path,
  count(*) as total,
  count(*) filter (where (payload->>'maxScrollDepth')::numeric >= 90) as completed,
  round(100.0 * count(*) filter (where (payload->>'maxScrollDepth')::numeric >= 90)
    / count(*), 1) as completion_rate
from TABLE
where payload->>'eventType' = 'page_exit'
group by 1
having count(*) > 10
order by completion_rate desc
limit 20
```

### 7. TOC heavy usage — page length / organization signal

```sql
select
  payload->>'path' as path,
  count(*) filter (where payload->>'eventType' = 'toc_click') as toc_clicks,
  count(*) filter (where payload->>'eventType' = 'page_view') as views,
  round(100.0 * count(*) filter (where payload->>'eventType' = 'toc_click')
    / count(*) filter (where payload->>'eventType' = 'page_view'), 1) as toc_rate
from TABLE
where payload->>'eventType' in ('toc_click', 'page_view')
group by 1
having count(*) filter (where payload->>'eventType' = 'page_view') > 10
order by toc_rate desc
limit 20
```

### 8. Tab switch preferences

```sql
select payload->>'tabLabel' as tab_label, count(*) as switches
from TABLE
where payload->>'eventType' = 'tab_switch' and (payload->>'isDefault')::boolean = false
group by 1
order by switches desc
limit 20
```

### 9. Feedback by page

```sql
select
  payload->>'path' as path,
  count(*) as total,
  count(*) filter (where payload->>'rating' = 'yes') as helpful,
  count(*) filter (where payload->>'rating' = 'no') as not_helpful,
  round(count(*) filter (where payload->>'rating' = 'yes') * 100.0 / count(*), 1) as helpful_pct
from TABLE
where payload->>'eventType' = 'feedback'
group by 1
having count(*) >= 3
order by helpful_pct asc
```

### 10. Traffic sources

```sql
select payload->>'referrerCategory' as referrer_category, count(*) as sessions
from TABLE
where payload->>'eventType' = 'page_view' and (payload->>'isFirstPage')::boolean = true
group by 1
order by sessions desc
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
