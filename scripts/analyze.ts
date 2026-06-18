#!/usr/bin/env npx tsx
/**
 * Do11y audit — fetch events from Supabase and compute all audit metrics.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   SUPABASE_TABLE=do11y_events \
 *   npx tsx scripts/analyze.ts
 *
 * Environment variables:
 *   SUPABASE_URL         — Supabase project URL (required)
 *   SUPABASE_SECRET_KEY  — Secret key (sb_secret_...) for reading data (required)
 *   SUPABASE_TABLE       — Table name (default: do11y_events)
 *   DAYS_BACK            — Number of days to analyze (default: 90)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '90', 10);

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL is required');
  process.exit(1);
}

if (!SUPABASE_SECRET_KEY) {
  console.error('Error: SUPABASE_SECRET_KEY is required');
  process.exit(1);
}

interface EventPayload {
  _time: string;
  eventType: string;
  path: string;
  activeTimeSeconds?: number;
  maxScrollDepth?: number;
  isFirstPage?: boolean;
  referrerCategory?: string;
  tabLabel?: string;
  isDefault?: boolean;
  rating?: string;
  language?: string;
  testFramework?: string;
  testRunId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function round(n: number, digits = 1): number {
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

function isEngagementExcludedPath(path: string): boolean {
  return path.startsWith('/pixel/');
}

/** Drop scroll/engagement events for non-doc paths such as tracking pixels. */
function filterEngagementEvents(events: EventPayload[]): EventPayload[] {
  return events.filter((e) => {
    if (!isEngagementExcludedPath(e.path)) return true;
    return (
      e.eventType !== 'page_exit' &&
      e.eventType !== 'scroll_depth' &&
      e.eventType !== 'section_visible'
    );
  });
}

async function fetchRowCount(): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=id&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) throw new Error(`Count failed (${res.status}): ${await res.text()}`);
  const range = res.headers.get('content-range');
  const match = range?.match(/\/(\d+)$/);
  return match ? parseInt(match[1]!, 10) : 0;
}

async function fetchAllEvents(): Promise<EventPayload[]> {
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set('select', 'payload');
  url.searchParams.set('payload->>_time', `gte.${since}`);
  url.searchParams.set('limit', '50000');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);

  const rows = (await res.json()) as { payload: EventPayload }[];
  return rows.map((r) => r.payload);
}

function eventTypeCounts(events: EventPayload[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.eventType, (counts.get(e.eventType) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function sectionTraffic(events: EventPayload[]) {
  const bySection = new Map<string, { visits: number; times: number[]; scrolls: number[] }>();
  for (const e of events.filter((ev) => ev.eventType === 'page_exit')) {
    const parts = e.path.split('/').filter(Boolean);
    const section = parts[2] || parts[0] || '(root)';
    if (!bySection.has(section)) bySection.set(section, { visits: 0, times: [], scrolls: [] });
    const s = bySection.get(section)!;
    s.visits++;
    if (typeof e.activeTimeSeconds === 'number') s.times.push(e.activeTimeSeconds);
    if (typeof e.maxScrollDepth === 'number') s.scrolls.push(e.maxScrollDepth);
  }
  return [...bySection.entries()]
    .map(([section, d]) => ({
      section,
      visits: d.visits,
      avg_time: round(avg(d.times)),
      avg_scroll: round(avg(d.scrolls)),
    }))
    .sort((a, b) => b.visits - a.visits);
}

function exitsByPath(events: EventPayload[]) {
  const map = new Map<string, { times: number[]; scrolls: number[] }>();
  for (const e of events.filter((ev) => ev.eventType === 'page_exit')) {
    if (!map.has(e.path)) map.set(e.path, { times: [], scrolls: [] });
    const p = map.get(e.path)!;
    if (typeof e.activeTimeSeconds === 'number') p.times.push(e.activeTimeSeconds);
    if (typeof e.maxScrollDepth === 'number') p.scrolls.push(e.maxScrollDepth);
  }
  return map;
}

function pathViewsAndSearches(events: EventPayload[]) {
  const map = new Map<string, { views: number; searches: number }>();
  for (const e of events) {
    if (!e.path) continue;
    if (!map.has(e.path)) map.set(e.path, { views: 0, searches: 0 });
    const p = map.get(e.path)!;
    if (e.eventType === 'page_view') p.views++;
    if (e.eventType === 'search_opened') p.searches++;
  }
  return map;
}

async function main() {
  const totalRows = await fetchRowCount();
  const events = filterEngagementEvents(await fetchAllEvents());
  const times = events.map((e) => e._time).sort();

  const exits = exitsByPath(events);
  const pathStats = pathViewsAndSearches(events);

  const pageExits = [...exits.entries()]
    .map(([path, d]) => ({
      path,
      visits: Math.max(d.times.length, d.scrolls.length),
      avg_time: round(avg(d.times)),
      avg_scroll: round(avg(d.scrolls)),
    }))
    .sort((a, b) => b.visits - a.visits);

  const tocByPath = new Map<string, number>();
  for (const e of events.filter((ev) => ev.eventType === 'toc_click')) {
    tocByPath.set(e.path, (tocByPath.get(e.path) || 0) + 1);
  }

  const testFrameworks = new Map<string, number>();
  for (const e of events) {
    if (e.testFramework) testFrameworks.set(e.testFramework, (testFrameworks.get(e.testFramework) || 0) + 1);
  }
  const isIntegrationTestData = testFrameworks.size > 0 || events.some((e) => e.testRunId);

  const codeCopied = events.filter((e) => e.eventType === 'code_copied');
  const unknownLang = codeCopied.filter((e) => e.language === 'unknown' || !e.language).length;
  const firstPageViews = events.filter((e) => e.eventType === 'page_view' && e.isFirstPage);
  const nullReferrer = firstPageViews.filter((e) => !e.referrerCategory).length;

  const sessionPages = new Map<string, number>();
  for (const e of events.filter((ev) => ev.eventType === 'page_view')) {
    if (e.sessionId) sessionPages.set(e.sessionId, (sessionPages.get(e.sessionId) || 0) + 1);
  }
  const pageCounts = [...sessionPages.values()];

  const report = {
    meta: {
      table: SUPABASE_TABLE,
      days_back: DAYS_BACK,
      total_rows_in_table: totalRows,
      events_fetched: events.length,
      date_range:
        times.length > 0 ? { from: times[0], to: times[times.length - 1] } : null,
      is_integration_test_data: isIntegrationTestData,
      test_frameworks: Object.fromEntries(testFrameworks),
    },
    event_types: eventTypeCounts(events),
    instrumentation: {
      null_referrer_pct: firstPageViews.length
        ? round((100 * nullReferrer) / firstPageViews.length)
        : 0,
      code_copied_total: codeCopied.length,
      unknown_language_pct: codeCopied.length
        ? round((100 * unknownLang) / codeCopied.length)
        : 0,
      code_languages: Object.fromEntries(
        [...new Set(codeCopied.map((e) => String(e.language || '(missing)')))]
          .map((lang) => [lang, codeCopied.filter((e) => String(e.language || '(missing)') === lang).length]),
      ),
      feedback_events: events.filter((e) => e.eventType === 'feedback').length,
      feedback_ratings: Object.fromEntries(
        [...new Set(events.filter((e) => e.eventType === 'feedback').map((e) => String(e.rating || '(missing)')))]
          .map((r) => [
            r,
            events.filter((e) => e.eventType === 'feedback' && String(e.rating || '(missing)') === r).length,
          ]),
      ),
      toc_clicks: events.filter((e) => e.eventType === 'toc_click').length,
      page_views: events.filter((e) => e.eventType === 'page_view').length,
    },
    sessions: {
      count: sessionPages.size,
      avg_pages_per_session: round(avg(pageCounts)),
      single_page_sessions_pct: sessionPages.size
        ? round((100 * pageCounts.filter((c) => c === 1).length) / sessionPages.size)
        : 0,
    },
    section_traffic: sectionTraffic(events),
    top_entry_points: [...events
      .filter((e) => e.eventType === 'page_view' && e.isFirstPage)
      .reduce((m, e) => m.set(e.path, (m.get(e.path) || 0) + 1), new Map<string, number>())
      .entries()]
      .map(([path, entries]) => ({ path, entries }))
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 25),
    traffic_sources: [...events
      .filter((e) => e.eventType === 'page_view' && e.isFirstPage)
      .reduce(
        (m, e) => m.set(e.referrerCategory ?? '(null)', (m.get(e.referrerCategory ?? '(null)') || 0) + 1),
        new Map<string, number>(),
      )
      .entries()]
      .map(([referrer_category, sessions]) => ({ referrer_category, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
    page_exits: pageExits,
    high_search_rate: [...pathStats.entries()]
      .filter(([, d]) => d.views > 10)
      .map(([path, d]) => ({
        path,
        page_views: d.views,
        searches: d.searches,
        search_rate: round((100 * d.searches) / d.views),
      }))
      .sort((a, b) => b.search_rate - a.search_rate)
      .slice(0, 20),
    bounce_candidates: pageExits.filter(
      (p) => p.visits > 5 && p.avg_time < 10 && p.avg_scroll < 25,
    ),
    high_traffic_low_engagement: pageExits.filter((p) => p.visits > 20 && p.avg_scroll < 30),
    scroll_completion: pageExits
      .map((p) => {
        const scrolls = exits.get(p.path)?.scrolls ?? [];
        const completed = scrolls.filter((s) => s >= 90).length;
        return {
          path: p.path,
          total: scrolls.length,
          completed,
          completion_rate: scrolls.length ? round((100 * completed) / scrolls.length) : 0,
        };
      })
      .filter((p) => p.total > 10)
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 20),
    heavy_toc_usage: [...pathStats.entries()]
      .filter(([, d]) => d.views > 10)
      .map(([path, d]) => ({
        path,
        toc_clicks: tocByPath.get(path) || 0,
        views: d.views,
        toc_rate: round((100 * (tocByPath.get(path) || 0)) / d.views),
      }))
      .sort((a, b) => b.toc_rate - a.toc_rate)
      .slice(0, 20),
    tab_switches: [...events
      .filter((e) => e.eventType === 'tab_switch' && e.isDefault === false && e.tabLabel)
      .reduce((m, e) => m.set(e.tabLabel!, (m.get(e.tabLabel!) || 0) + 1), new Map<string, number>())
      .entries()]
      .map(([tab_label, switches]) => ({ tab_label, switches }))
      .sort((a, b) => b.switches - a.switches)
      .slice(0, 20),
    feedback_by_page: [...events
      .filter((e) => e.eventType === 'feedback')
      .reduce(
        (m, e) => {
          if (!m.has(e.path)) m.set(e.path, { total: 0, yes: 0, no: 0 });
          const f = m.get(e.path)!;
          f.total++;
          if (e.rating === 'yes') f.yes++;
          if (e.rating === 'no') f.no++;
          return m;
        },
        new Map<string, { total: number; yes: number; no: number }>(),
      )
      .entries()]
      .filter(([, f]) => f.total >= 3)
      .map(([path, f]) => ({
        path,
        total: f.total,
        helpful: f.yes,
        not_helpful: f.no,
        helpful_pct: round((100 * f.yes) / f.total),
      }))
      .sort((a, b) => a.helpful_pct - b.helpful_pct),
    per_framework: [...events.reduce((m, e) => {
      if (!e.testFramework) return m;
      if (!m.has(e.testFramework)) m.set(e.testFramework, { views: 0, exits: 0, toc: 0, search: 0 });
      const x = m.get(e.testFramework)!;
      if (e.eventType === 'page_view') x.views++;
      if (e.eventType === 'page_exit') x.exits++;
      if (e.eventType === 'toc_click') x.toc++;
      if (e.eventType === 'search_opened') x.search++;
      return m;
    }, new Map<string, { views: number; exits: number; toc: number; search: number }>())
      .entries()]
      .map(([framework, d]) => ({ framework, ...d })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
