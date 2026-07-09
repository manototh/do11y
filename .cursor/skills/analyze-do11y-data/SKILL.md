---
name: analyze-do11y-data
description: Query and interpret documentation analytics data collected by Do11y. Use when asked to analyze docs performance, find pages to improve, interpret engagement metrics, investigate user behavior, audit instrumentation quality, or produce optimization recommendations from Do11y data.
---

# Analyze Do11y data

## Agent workflow

Follow these steps in order. Do not skip to ad-hoc curl or inline scripts.

1. **Get credentials** from the user message.
2. **Run the audit script** (one command, one fetch, all metrics):

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."
export SUPABASE_TABLE="do11y_events"   # optional, this is the default
export DAYS_BACK=90                    # optional, default 90

npx tsx scripts/analyze.ts
```

3. **Parse the JSON output** and write the report using [Report structure](#report-structure) below.

## Setup

Ask for these credentials if not already provided:

| Credential | Environment variable | Default |
|---|---|---|
| Supabase URL | `SUPABASE_URL` | — |
| Supabase secret key | `SUPABASE_SECRET_KEY` | — |
| Supabase table | `SUPABASE_TABLE` | `do11y_events` |
| Time range | `DAYS_BACK` | `90` |

Find the secret key under **Project settings > API Keys > Secret keys**.

## How to query

PostgREST does not run raw SQL. `scripts/analyze.ts` fetches all events in one REST call and aggregates in memory. The SQL blocks below document what the script computes.

Events are stored as JSONB in the `payload` column. All field names follow [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/). Relevant fields:

| Field | Used for |
|---|---|
| `eventName` | Filter by event kind (`browser.do11y.page_view`, `browser.do11y.page_exit`, etc.) |
| `url.path` | Page-level grouping |
| `_time` | Time range filter |
| `browser.do11y.page_exit.active_time_seconds`, `browser.do11y.page_exit.max_scroll_depth` | Engagement on `page_exit` |
| `browser.do11y.is_first_page`, `browser.do11y.referrer_category` | Entry points and traffic sources |
| `testFramework`, `testRunId` | Integration test detection |

## Pitfalls

| Do not | Do instead |
|---|---|
| Inline env vars with curl in one line (`SUPABASE_URL=... curl "${SUPABASE_URL}..."`) | `export` variables first, then run curl or the script |
| `npx tsx -e 'await fetch(...)'` | Use `scripts/analyze.ts` (top-level await fails in `-e` mode) |
| Write a temporary analysis script | Use `scripts/analyze.ts` |
| Multiple REST calls per event type | One fetch in `scripts/analyze.ts`, aggregate locally |
| Raw SQL via REST | Fetch via PostgREST filters, aggregate in the script |

### Smoke-test connectivity

Only if the audit script fails, verify credentials with export + curl:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."
export SUPABASE_TABLE="do11y_events"

curl -s "${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=payload&limit=3" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}"
```

Row count (optional sanity check):

```bash
curl -sI "${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=id&limit=1" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
  -H "Prefer: count=exact" | grep -i content-range
```

## Audit script output

`scripts/analyze.ts` prints a single JSON object. Key sections map to the report:

| JSON key | Report section |
|---|---|
| `instrumentation` | Instrumentation gaps |
| `top_entry_points`, `section_traffic`, `traffic_sources`, `sessions` | Traffic overview |
| `bounce_candidates`, `high_traffic_low_engagement`, `page_exits` | Engagement problems |
| `high_search_rate`, `heavy_toc_usage` | Confusion signals |
| `scroll_completion`, `page_exits` (high scroll) | High-performing content |
| `page_exits` (path variants, zero-scroll paths) | Routing issues |
| `per_framework` | Framework-specific instrumentation gaps (test tables) |

## SQL reference

Replace `TABLE` with the Supabase table name. Implemented by `scripts/analyze.ts`.

### 1. Section-level traffic and engagement

```sql
select
  split_part(payload->>'url.path', '/', 3) as section,
  count(*) as visits,
  avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as avg_time,
  avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as avg_scroll
from TABLE
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
order by visits desc
```

### 2. Top entry points

```sql
select payload->>'url.path' as path, count(*) as entries
from TABLE
where payload->>'eventName' = 'browser.do11y.page_view' and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1
order by entries desc
limit 25
```

### 3. High search rate — confusion signal

```sql
select
  payload->>'url.path' as path,
  count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as page_views,
  count(*) filter (where payload->>'eventName' = 'browser.do11y.search_opened') as searches,
  round(100.0 * count(*) filter (where payload->>'eventName' = 'browser.do11y.search_opened')
    / count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view'), 1) as search_rate
from TABLE
group by 1
having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 10
order by search_rate desc
limit 20
```

### 4. Bounce detection

```sql
select
  payload->>'url.path' as path,
  avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as avg_time,
  avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as avg_scroll,
  count(*) as visits
from TABLE
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
having count(*) > 5
  and avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) < 10
  and avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) < 25
order by visits desc
```

### 5. High-traffic, low-engagement pages

```sql
select
  payload->>'url.path' as path,
  count(*) as visits,
  avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) as avg_scroll,
  avg((payload->>'browser.do11y.page_exit.active_time_seconds')::numeric) as avg_time
from TABLE
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
having count(*) > 20 and avg((payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric) < 30
order by visits desc
```

### 6. Scroll completion rate

```sql
select
  payload->>'url.path' as path,
  count(*) as total,
  count(*) filter (where (payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric >= 90) as completed,
  round(100.0 * count(*) filter (where (payload->>'browser.do11y.page_exit.max_scroll_depth')::numeric >= 90)
    / count(*), 1) as completion_rate
from TABLE
where payload->>'eventName' = 'browser.do11y.page_exit'
group by 1
having count(*) > 10
order by completion_rate desc
limit 20
```

### 7. TOC heavy usage — page length / organization signal

```sql
select
  payload->>'url.path' as path,
  count(*) filter (where payload->>'eventName' = 'browser.do11y.toc_click') as toc_clicks,
  count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') as views,
  round(100.0 * count(*) filter (where payload->>'eventName' = 'browser.do11y.toc_click')
    / count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view'), 1) as toc_rate
from TABLE
where payload->>'eventName' in ('browser.do11y.toc_click', 'browser.do11y.page_view')
group by 1
having count(*) filter (where payload->>'eventName' = 'browser.do11y.page_view') > 10
order by toc_rate desc
limit 20
```

### 8. Tab switch preferences

```sql
select payload->>'browser.do11y.tab.label' as tab_label, count(*) as switches
from TABLE
where payload->>'eventName' = 'browser.do11y.tab_switch' and (payload->>'browser.do11y.tab.is_default')::boolean = false
group by 1
order by switches desc
limit 20
```

### 9. Feedback by page

```sql
select
  payload->>'url.path' as path,
  count(*) as total,
  count(*) filter (where payload->>'browser.do11y.feedback.rating' = 'yes') as helpful,
  count(*) filter (where payload->>'browser.do11y.feedback.rating' = 'no') as not_helpful,
  round(count(*) filter (where payload->>'browser.do11y.feedback.rating' = 'yes') * 100.0 / count(*), 1) as helpful_pct
from TABLE
where payload->>'eventName' = 'browser.do11y.feedback'
group by 1
having count(*) >= 3
order by helpful_pct asc
```

Also check `instrumentation.feedback_ratings` in the script output.

### 10. Traffic sources

```sql
select payload->>'browser.do11y.referrer_category' as referrer_category, count(*) as sessions
from TABLE
where payload->>'eventName' = 'browser.do11y.page_view' and (payload->>'browser.do11y.is_first_page')::boolean = true
group by 1
order by sessions desc
```

## Instrumentation health checks

Read from `instrumentation` in the script output, or check manually:

| Check | How to spot it | Likely cause |
|---|---|---|
| Referrer tracking blind | > 90% null `browser.do11y.referrer_category` | Referrer classification not running before first `page_view` fires |
| Code language unknown | > 90% `browser.do11y.code.language` is `"unknown"` in `code_copied` events | Code block language not detected from CSS class or attribute |
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
