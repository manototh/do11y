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
  eventName: string;
  'url.path'?: string;
  'browser.do11y.page_exit.active_time_seconds'?: number;
  'browser.do11y.page_exit.max_scroll_depth'?: number;
  'browser.do11y.is_first_page'?: boolean;
  'browser.do11y.referrer_category'?: string;
  'browser.do11y.tab.label'?: string;
  'browser.do11y.tab.is_default'?: boolean;
  'browser.do11y.feedback.rating'?: string;
  'browser.do11y.code.language'?: string;
  testFramework?: string;
  testRunId?: string;
  'session.id'?: string;
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
    const path = e['url.path'] || '';
    if (!isEngagementExcludedPath(path)) return true;
    return (
      e.eventName !== 'browser.do11y.page_exit' &&
      e.eventName !== 'browser.do11y.scroll_depth' &&
      e.eventName !== 'browser.do11y.section_visible'
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
  for (const e of events) counts.set(e.eventName, (counts.get(e.eventName) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function sectionTraffic(events: EventPayload[]) {
  const bySection = new Map<string, { visits: number; times: number[]; scrolls: number[] }>();
  for (const e of events.filter((ev) => ev.eventName === 'browser.do11y.page_exit')) {
    const path = e['url.path'] || '';
    const parts = path.split('/').filter(Boolean);
    const section = parts[2] || parts[0] || '(root)';
    if (!bySection.has(section)) bySection.set(section, { visits: 0, times: [], scrolls: [] });
    const s = bySection.get(section)!;
    s.visits++;
    if (typeof e['browser.do11y.page_exit.active_time_seconds'] === 'number') s.times.push(e['browser.do11y.page_exit.active_time_seconds']);
    if (typeof e['browser.do11y.page_exit.max_scroll_depth'] === 'number') s.scrolls.push(e['browser.do11y.page_exit.max_scroll_depth']);
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
  for (const e of events.filter((ev) => ev.eventName === 'browser.do11y.page_exit')) {
    const path = e['url.path'] || '';
    if (!map.has(path)) map.set(path, { times: [], scrolls: [] });
    const p = map.get(path)!;
    if (typeof e['browser.do11y.page_exit.active_time_seconds'] === 'number') p.times.push(e['browser.do11y.page_exit.active_time_seconds']);
    if (typeof e['browser.do11y.page_exit.max_scroll_depth'] === 'number') p.scrolls.push(e['browser.do11y.page_exit.max_scroll_depth']);
  }
  return map;
}

function pathViewsAndSearches(events: EventPayload[]) {
  const map = new Map<string, { views: number; searches: number }>();
  for (const e of events) {
    const path = e['url.path'] || '';
    if (!path) continue;
    if (!map.has(path)) map.set(path, { views: 0, searches: 0 });
    const p = map.get(path)!;
    if (e.eventName === 'browser.do11y.page_view') p.views++;
    if (e.eventName === 'browser.do11y.search_opened') p.searches++;
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
  for (const e of events.filter((ev) => ev.eventName === 'browser.do11y.toc_click')) {
    const path = e['url.path'] || '';
    tocByPath.set(path, (tocByPath.get(path) || 0) + 1);
  }

  const testFrameworks = new Map<string, number>();
  for (const e of events) {
    if (e.testFramework) testFrameworks.set(e.testFramework, (testFrameworks.get(e.testFramework) || 0) + 1);
  }
  const isIntegrationTestData = testFrameworks.size > 0 || events.some((e) => e.testRunId);

  const codeCopied = events.filter((e) => e.eventName === 'browser.do11y.code_copied');
  const unknownLang = codeCopied.filter((e) => (e['browser.do11y.code.language'] === 'unknown' || !e['browser.do11y.code.language'])).length;
  const firstPageViews = events.filter((e) => e.eventName === 'browser.do11y.page_view' && e['browser.do11y.is_first_page']);
  const nullReferrer = firstPageViews.filter((e) => !e['browser.do11y.referrer_category']).length;

  const sessionPages = new Map<string, number>();
  for (const e of events.filter((ev) => ev.eventName === 'browser.do11y.page_view')) {
    const sid = e['session.id'];
    if (sid) sessionPages.set(sid, (sessionPages.get(sid) || 0) + 1);
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
        [...new Set(codeCopied.map((e) => String(e['browser.do11y.code.language'] || '(missing)')))]
          .map((lang) => [lang, codeCopied.filter((e) => String(e['browser.do11y.code.language'] || '(missing)') === lang).length]),
      ),
      feedback_events: events.filter((e) => e.eventName === 'browser.do11y.feedback').length,
      feedback_ratings: Object.fromEntries(
        [...new Set(events.filter((e) => e.eventName === 'browser.do11y.feedback').map((e) => String(e['browser.do11y.feedback.rating'] || '(missing)')))]
          .map((r) => [
            r,
            events.filter((e) => e.eventName === 'browser.do11y.feedback' && String(e['browser.do11y.feedback.rating'] || '(missing)') === r).length,
          ]),
      ),
      toc_clicks: events.filter((e) => e.eventName === 'browser.do11y.toc_click').length,
      page_views: events.filter((e) => e.eventName === 'browser.do11y.page_view').length,
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
      .filter((e) => e.eventName === 'browser.do11y.page_view' && e['browser.do11y.is_first_page'])
      .reduce((m, e) => m.set(e['url.path'] || '', (m.get(e['url.path'] || '') || 0) + 1), new Map<string, number>())
      .entries()]
      .map(([path, entries]) => ({ path, entries }))
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 25),
    traffic_sources: [...events
      .filter((e) => e.eventName === 'browser.do11y.page_view' && e['browser.do11y.is_first_page'])
      .reduce(
        (m, e) => m.set(e['browser.do11y.referrer_category'] ?? '(null)', (m.get(e['browser.do11y.referrer_category'] ?? '(null)') || 0) + 1),
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
      .filter((e) => e.eventName === 'browser.do11y.tab_switch' && e['browser.do11y.tab.is_default'] === false && e['browser.do11y.tab.label'])
      .reduce((m, e) => m.set(e['browser.do11y.tab.label']!, (m.get(e['browser.do11y.tab.label']!) || 0) + 1), new Map<string, number>())
      .entries()]
      .map(([tab_label, switches]) => ({ tab_label, switches }))
      .sort((a, b) => b.switches - a.switches)
      .slice(0, 20),
    feedback_by_page: [...events
      .filter((e) => e.eventName === 'browser.do11y.feedback')
      .reduce(
        (m, e) => {
          const path = e['url.path'] || '';
          if (!m.has(path)) m.set(path, { total: 0, yes: 0, no: 0 });
          const f = m.get(path)!;
          f.total++;
          if (e['browser.do11y.feedback.rating'] === 'yes') f.yes++;
          if (e['browser.do11y.feedback.rating'] === 'no') f.no++;
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
      if (e.eventName === 'browser.do11y.page_view') x.views++;
      if (e.eventName === 'browser.do11y.page_exit') x.exits++;
      if (e.eventName === 'browser.do11y.toc_click') x.toc++;
      if (e.eventName === 'browser.do11y.search_opened') x.search++;
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
