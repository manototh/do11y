#!/usr/bin/env npx tsx
// Originally derived from https://github.com/axiomhq/do11y
/**
 * Do11y Insights — generate actionable documentation recommendations from
 * behavioral analytics stored in Tinybird.
 *
 * Usage:
 *   TINYBIRD_TOKEN=... TINYBIRD_HOST=api.tinybird.co TINYBIRD_DATASOURCE=do11y \
 *   OPENAI_API_KEY=... npx tsx scripts/insights.ts
 *
 * Environment variables:
 *   TINYBIRD_TOKEN      — Tinybird token with read access to the datasource
 *   TINYBIRD_HOST       — Tinybird API host (default: api.tinybird.co)
 *   TINYBIRD_DATASOURCE — Datasource name (default: do11y)
 *   OPENAI_API_KEY      — OpenAI API key for generating recommendations
 *   OPENAI_MODEL        — Model to use (default: gpt-4o)
 *   DAYS_BACK           — Number of days to analyze (default: 30)
 */

const TINYBIRD_TOKEN = process.env.TINYBIRD_TOKEN;
const TINYBIRD_HOST = process.env.TINYBIRD_HOST || 'api.tinybird.co';
const TINYBIRD_DATASOURCE = process.env.TINYBIRD_DATASOURCE || 'do11y';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '30', 10);

if (!TINYBIRD_TOKEN) {
  console.error('Error: TINYBIRD_TOKEN environment variable is required');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

interface TinybirdRow {
  [key: string]: unknown;
}

interface TinybirdResponse {
  data: TinybirdRow[];
  rows: number;
  statistics: { elapsed: number; rows_read: number; bytes_read: number };
}

async function queryTinybird(sql: string): Promise<TinybirdRow[]> {
  const url = `https://${TINYBIRD_HOST}/v0/sql?q=${encodeURIComponent(sql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TINYBIRD_TOKEN}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tinybird query failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as TinybirdResponse;
  return json.data;
}

async function gatherMetrics(): Promise<Record<string, TinybirdRow[]>> {
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
  const ds = TINYBIRD_DATASOURCE;

  const queries: Record<string, string> = {
    highTrafficLowEngagement: `
      SELECT path, count() as visits, avg(activeTimeSeconds) as avgTime, avg(maxScrollDepth) as avgScroll
      FROM ${ds}
      WHERE eventType = 'page_exit' AND _time >= '${since}'
      GROUP BY path
      HAVING visits > 10 AND avgScroll < 30
      ORDER BY visits DESC
      LIMIT 10
    `,
    confusionSignals: `
      SELECT path,
        countIf(eventType = 'page_view') as pageViews,
        countIf(eventType = 'search_opened') as searches
      FROM ${ds}
      WHERE _time >= '${since}'
      GROUP BY path
      HAVING pageViews > 10
      ORDER BY searches / pageViews DESC
      LIMIT 10
    `,
    heavyTocUsage: `
      SELECT path,
        countIf(eventType = 'toc_click') as tocClicks,
        countIf(eventType = 'page_view') as views
      FROM ${ds}
      WHERE _time >= '${since}'
      GROUP BY path
      HAVING views > 10
      ORDER BY tocClicks / views DESC
      LIMIT 10
    `,
    highPerformers: `
      SELECT path, count() as visits, avg(maxScrollDepth) as avgScroll, avg(activeTimeSeconds) as avgTime
      FROM ${ds}
      WHERE eventType = 'page_exit' AND _time >= '${since}'
      GROUP BY path
      HAVING visits > 10 AND avgScroll > 70
      ORDER BY avgScroll DESC
      LIMIT 5
    `,
    bouncePages: `
      SELECT path, count() as visits, avg(activeTimeSeconds) as avgTime, avg(maxScrollDepth) as avgScroll
      FROM ${ds}
      WHERE eventType = 'page_exit' AND _time >= '${since}'
      GROUP BY path
      HAVING visits > 5 AND avgTime < 10 AND avgScroll < 25
      ORDER BY visits DESC
      LIMIT 10
    `,
  };

  const results: Record<string, TinybirdRow[]> = {};

  const entries = Object.entries(queries);
  const settled = await Promise.allSettled(
    entries.map(([, sql]) => queryTinybird(sql))
  );

  for (let i = 0; i < entries.length; i++) {
    const [key] = entries[i]!;
    const result = settled[i]!;
    if (result.status === 'fulfilled') {
      results[key] = result.value;
    } else {
      console.warn(`Query "${key}" failed:`, result.reason);
      results[key] = [];
    }
  }

  return results;
}

async function generateRecommendations(metrics: Record<string, TinybirdRow[]>): Promise<string> {
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
  console.log(`Gathering metrics from Tinybird (last ${DAYS_BACK} days)...`);
  const metrics = await gatherMetrics();

  const totalRows = Object.values(metrics).reduce((sum, rows) => sum + rows.length, 0);
  if (totalRows === 0) {
    console.log('No data found. Make sure Do11y is sending events to your Tinybird datasource.');
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
