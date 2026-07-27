#!/usr/bin/env npx tsx
// Originally derived from https://github.com/axiomhq/do11y
/**
 * Do11y Insights — generate actionable documentation recommendations from
 * behavioral analytics stored in Supabase.
 *
 * Uses the Supabase REST API (no direct Postgres connection needed).
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   OPENAI_API_KEY=... npx tsx scripts/insights.ts
 *
 * Environment variables:
 *   SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SECRET_KEY  — Secret key (sb_secret_...) for reading data
 *   SUPABASE_TABLE       — Table name (default: do11y_events)
 *   OPENAI_API_KEY       — OpenAI API key for generating recommendations
 *   OPENAI_MODEL         — Model to use (default: gpt-4o)
 *   DAYS_BACK            — Number of days to analyze (default: 90)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '90', 10);

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL environment variable is required');
  console.error('This is your Supabase project URL (e.g. https://abc123.supabase.co)');
  process.exit(1);
}

if (!SUPABASE_SECRET_KEY) {
  console.error('Error: SUPABASE_SECRET_KEY environment variable is required');
  console.error('Find it in Supabase dashboard: Settings > API Keys > secret key (sb_secret_...)');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
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
  referrerDomain?: string;
  aiPlatform?: string;
  tabLabel?: string;
  isDefault?: boolean;
  rating?: string;
  [key: string]: unknown;
}

interface Row {
  payload: EventPayload;
}

async function fetchEvents(eventTypes: string[]): Promise<EventPayload[]> {
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`);
  url.searchParams.set('select', 'payload');
  url.searchParams.set('payload->>eventType', `in.(${eventTypes.join(',')})`);
  url.searchParams.set('payload->>_time', `gte.${since}`);
  url.searchParams.set('limit', '50000');

  const res = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_SECRET_KEY!,
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }

  const rows = await res.json() as Row[];
  return rows.map(r => r.payload);
}

interface PageMetrics {
  path: string;
  visits: number;
  avgTime: number;
  avgScroll: number;
}

function isEngagementExcludedPath(path: string): boolean {
  return path.startsWith('/pixel/');
}

function aggregatePageExits(events: EventPayload[]): PageMetrics[] {
  const byPath = new Map<string, { times: number[]; scrolls: number[] }>();

  for (const e of events) {
    if (e.eventType !== 'page_exit') continue;
    const path = e.path;
    if (isEngagementExcludedPath(path)) continue;
    if (!byPath.has(path)) byPath.set(path, { times: [], scrolls: [] });
    const entry = byPath.get(path)!;
    if (typeof e.activeTimeSeconds === 'number') entry.times.push(e.activeTimeSeconds);
    if (typeof e.maxScrollDepth === 'number') entry.scrolls.push(e.maxScrollDepth);
  }

  const results: PageMetrics[] = [];
  for (const [path, data] of byPath) {
    const visits = data.times.length || data.scrolls.length;
    const avgTime = data.times.length > 0
      ? data.times.reduce((a, b) => a + b, 0) / data.times.length
      : 0;
    const avgScroll = data.scrolls.length > 0
      ? data.scrolls.reduce((a, b) => a + b, 0) / data.scrolls.length
      : 0;
    results.push({ path, visits, avgTime: Math.round(avgTime * 10) / 10, avgScroll: Math.round(avgScroll * 10) / 10 });
  }

  return results;
}

async function gatherMetrics(): Promise<Record<string, unknown[]>> {
  console.log('  Fetching page_exit events...');
  const exitEvents = await fetchEvents(['page_exit']);

  console.log('  Fetching page_view and search events...');
  const viewSearchEvents = await fetchEvents(['page_view', 'search_opened']);

  console.log('  Fetching toc_click events...');
  const tocEvents = await fetchEvents(['toc_click']);

  const pageMetrics = aggregatePageExits(exitEvents);

  const highTrafficLowEngagement = pageMetrics
    .filter(p => p.visits > 10 && p.avgScroll < 30)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  const bouncePages = pageMetrics
    .filter(p => p.visits > 5 && p.avgTime < 10 && p.avgScroll < 25)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  const highPerformers = pageMetrics
    .filter(p => p.visits > 10 && p.avgScroll > 70)
    .sort((a, b) => b.avgScroll - a.avgScroll)
    .slice(0, 5);

  // Confusion signals: pages with high search rate after landing
  const viewsByPath = new Map<string, number>();
  const searchesByPath = new Map<string, number>();
  for (const e of viewSearchEvents) {
    if (e.eventType === 'page_view') {
      viewsByPath.set(e.path, (viewsByPath.get(e.path) || 0) + 1);
    } else if (e.eventType === 'search_opened') {
      searchesByPath.set(e.path, (searchesByPath.get(e.path) || 0) + 1);
    }
  }
  const confusionSignals = [...viewsByPath.entries()]
    .filter(([, views]) => views > 10)
    .map(([path, pageViews]) => ({
      path,
      pageViews,
      searches: searchesByPath.get(path) || 0,
    }))
    .sort((a, b) => (b.searches / b.pageViews) - (a.searches / a.pageViews))
    .slice(0, 10);

  // Heavy TOC usage
  const tocByPath = new Map<string, number>();
  for (const e of tocEvents) {
    tocByPath.set(e.path, (tocByPath.get(e.path) || 0) + 1);
  }
  const heavyTocUsage = [...viewsByPath.entries()]
    .filter(([, views]) => views > 10)
    .map(([path, views]) => ({
      path,
      tocClicks: tocByPath.get(path) || 0,
      views,
    }))
    .sort((a, b) => (b.tocClicks / b.views) - (a.tocClicks / a.views))
    .slice(0, 10);

  return {
    highTrafficLowEngagement,
    confusionSignals,
    heavyTocUsage,
    highPerformers,
    bouncePages,
  };
}

async function generateRecommendations(metrics: Record<string, unknown[]>): Promise<string> {
  const prompt = `You are a documentation performance analyst. Based on the analytics data below (last ${DAYS_BACK} days), produce a short, prioritized report of what to fix in the documentation. Be specific about which pages need work and why.

## Data

### High-traffic pages with low engagement (low scroll depth, low time on page)
${JSON.stringify(metrics.highTrafficLowEngagement, null, 2)}

### Confusion signals (pages where users frequently open search after landing)
${JSON.stringify(metrics.confusionSignals, null, 2)}

### Heavy TOC usage (pages where users rely heavily on table of contents, suggesting poor organization or excessive length)
${JSON.stringify(metrics.heavyTocUsage, null, 2)}

### Bounce pages (very low time + very low scroll)
${JSON.stringify(metrics.bouncePages, null, 2)}

### High-performing pages (use as templates for rewrites)
${JSON.stringify(metrics.highPerformers, null, 2)}

## Output format

Produce a markdown report with these sections:
1. **Top 5 pages to fix this week** — the highest-impact changes, with a one-line explanation of the problem and suggested fix for each
2. **Confusion signals** — pages where users seem lost
3. **Structure problems** — pages that are too long or poorly organized
4. **Templates** — high-performing pages to use as models for rewrites

Keep it concise. No preamble.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> };
  return json.choices[0]!.message.content;
}

async function main() {
  console.log(`Gathering metrics from Supabase (last ${DAYS_BACK} days)...`);
  const metrics = await gatherMetrics();

  const totalRows = Object.values(metrics).reduce((sum, rows) => sum + rows.length, 0);
  if (totalRows === 0) {
    console.log('No data found. Make sure Do11y is sending events to your Supabase table.');
    process.exit(0);
  }

  console.log(`Found data across ${totalRows} rows. Generating recommendations...`);
  const report = await generateRecommendations(metrics);

  console.log('\n' + '='.repeat(60));
  console.log('DO11Y INSIGHTS REPORT');
  console.log('='.repeat(60) + '\n');
  console.log(report);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
