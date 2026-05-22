---
name: analyze-do11y-data
description: Query and interpret documentation analytics data collected by Do11y. Use when asked to analyze docs performance, find pages to improve, interpret engagement metrics, investigate user behavior, audit instrumentation quality, or produce optimization recommendations from Do11y data.
---

# Analyze Do11y data

## Setup

Ask for these credentials if not already provided:

- **Dataset** — Axiom dataset name
- **Token** — Axiom API token
- **Domain** — edge deployment domain example: `us-east-1.aws.edge.axiom.co`
- **Time range** — default last 90 days

## Running queries

```bash
curl -s -X POST "https://DOMAIN/v1/query/_apl?format=tabular`" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apl": "APL_QUERY", "startTime": "START", "endTime": "END"}'
```

Replace `['do11y']` with `['DATASET']` in every APL query. Results are in `tables[0].columns[]` (parallel arrays); field names are in `tables[0].fields[].name`.

Parse with:

```bash
| python3 -c "
import json,sys
d=json.load(sys.stdin)
cols=d['tables'][0]['columns']
fields=[f['name'] for f in d['tables'][0]['fields']]
for i in range(len(cols[0])):
    print({fields[j]: cols[j][i] for j in range(len(fields))})
"
```

## Analysis workflow

Run these queries in parallel for a full audit. All use `['do11y']` — replace with your dataset.

### 1. Section-level traffic and engagement

```apl
['do11y']
| extend section = extract("^/docs/([^/]+)", 1, path)
| where eventType == 'page_exit'
| summarize visits = count(), avgTime = avg(activeTimeSeconds), avgScroll = avg(maxScrollDepth) by section
| order by visits desc
```

### 2. Top entry points

```apl
['do11y']
| where eventType == 'page_view' and isFirstPage == true
| summarize entries = count() by path
| order by entries desc
| take 25
```

### 3. High search rate — confusion signal

```apl
['do11y']
| summarize pageViews = countif(eventType == 'page_view'), searches = countif(eventType == 'search_opened') by sessionId, path
| where pageViews > 0
| summarize totalViews = sum(pageViews), sessionsWithSearch = countif(searches > 0) by path
| extend searchRate = round(100.0 * sessionsWithSearch / totalViews, 1)
| where totalViews > 10
| order by searchRate desc
| take 20
```

### 4. Bounce detection

```apl
['do11y']
| where eventType == 'page_exit'
| summarize avgTime = avg(activeTimeSeconds), avgScroll = avg(maxScrollDepth), visits = count() by path
| where visits > 5 and avgTime < 10 and avgScroll < 25
| order by visits desc
```

### 5. High-traffic, low-engagement pages

```apl
['do11y']
| where eventType == 'page_exit'
| summarize visits = count(), avgScroll = avg(maxScrollDepth), avgTime = avg(activeTimeSeconds) by path
| where visits > 20 and avgScroll < 30
| order by visits desc
```

### 6. Scroll completion rate

```apl
['do11y']
| where eventType == 'page_exit'
| summarize total = count(), completed = countif(maxScrollDepth >= 90) by path
| extend completionRate = round(100.0 * completed / total, 1)
| where total > 10
| order by completionRate desc
| take 20
```

### 7. TOC heavy usage — page length / organization signal

```apl
['do11y']
| where eventType in ('toc_click', 'page_view')
| summarize tocClicks = countif(eventType == 'toc_click'), views = countif(eventType == 'page_view') by path
| where views > 10
| extend tocRate = round(100.0 * tocClicks / views, 1)
| order by tocRate desc
| take 20
```

### 8. Tab switch preferences

```apl
['do11y']
| where eventType == 'tab_switch' and isDefault == false
| summarize switches = count() by tabLabel
| order by switches desc
| take 20
```

### 9. Feedback by page

```apl
['do11y']
| where eventType == 'feedback'
| summarize total = count(), helpful = countif(rating == 'yes'), notHelpful = countif(rating == 'no') by path
| extend helpfulPct = round(helpful * 100.0 / total, 1)
| where total >= 3
| order by helpfulPct asc
```

### 10. Exit pages in multi-page sessions

```apl
['do11y']
| where eventType == 'page_view'
| order by _time asc
| summarize pages = make_list(path), pageCount = count() by sessionId
| where pageCount > 1
| extend lastPage = tostring(pages[array_length(pages) - 1])
| summarize exits = count() by lastPage
| order by exits desc
| take 20
```

### 11. Paths missing expected prefix — routing / redirect signal

```apl
['do11y']
| where eventType == 'page_view' and not(path startswith '/docs/')
| summarize visits = count() by path
| order by visits desc
| take 20
```

### 12. Traffic sources

```apl
['do11y']
| where eventType == 'page_view' and isFirstPage == true
| summarize sessions = count() by referrerCategory
| order by sessions desc
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

## Additional queries

For deeper analysis — AI traffic by platform, page-to-page transitions, code copy rates, section reading patterns, expand/collapse behaviour, device breakdown — see [QUERIES.md](../../QUERIES.md).
