#!/usr/bin/env npx tsx
// Originally derived from https://github.com/axiomhq/do11y
/**
 * Do11y Insights — generate actionable documentation recommendations from
 * behavioral analytics stored in Supabase (PostgreSQL).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... \
 *   OPENAI_API_KEY=... npx tsx scripts/insights.ts
 *
 * Environment variables:
 *   DATABASE_URL        — Supabase Postgres connection string (from Settings > Database)
 *   SUPABASE_TABLE      — Table name (default: do11y_events)
 *   OPENAI_API_KEY      — OpenAI API key for generating recommendations
 *   OPENAI_MODEL        — Model to use (default: gpt-4o)
 *   DAYS_BACK           — Number of days to analyze (default: 30)
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'do11y_events';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '30', 10);

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  console.error('Find it in your Supabase dashboard under Settings > Database > Connection string');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

interface Row {
  [key: string]: unknown;
}

async function queryDatabase(sql: string): Promise<Row[]> {
  // Use the pg module for direct Postgres queries
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function gatherMetrics(): Promise<Record<string, Row[]>> {
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
  const t = SUPABASE_TABLE;

  const queries: Record<string, string> = {
    highTrafficLowEngagement: `
      select
        payload->>'path' as path,
        count(*) as visits,
        avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
        avg((payload->>'maxScrollDepth')::numeric) as "avgScroll"
      from ${t}
      where payload->>'eventType' = 'page_exit'
        and (payload->>'_time')::timestamptz >= '${since}'::timestamptz
      group by payload->>'path'
      having count(*) > 10 and avg((payload->>'maxScrollDepth')::numeric) < 30
      order by count(*) desc
      limit 10
    `,
    confusionSignals: `
      select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'page_view') as "pageViews",
        count(*) filter (where payload->>'eventType' = 'search_opened') as searches
      from ${t}
      where (payload->>'_time')::timestamptz >= '${since}'::timestamptz
      group by payload->>'path'
      having count(*) filter (where payload->>'eventType' = 'page_view') > 10
      order by count(*) filter (where payload->>'eventType' = 'search_opened')::numeric
             / count(*) filter (where payload->>'eventType' = 'page_view')::numeric desc
      limit 10
    `,
    heavyTocUsage: `
      select
        payload->>'path' as path,
        count(*) filter (where payload->>'eventType' = 'toc_click') as "tocClicks",
        count(*) filter (where payload->>'eventType' = 'page_view') as views
      from ${t}
      where (payload->>'_time')::timestamptz >= '${since}'::timestamptz
      group by payload->>'path'
      having count(*) filter (where payload->>'eventType' = 'page_view') > 10
      order by count(*) filter (where payload->>'eventType' = 'toc_click')::numeric
             / count(*) filter (where payload->>'eventType' = 'page_view')::numeric desc
      limit 10
    `,
    highPerformers: `
      select
        payload->>'path' as path,
        count(*) as visits,
        avg((payload->>'maxScrollDepth')::numeric) as "avgScroll",
        avg((payload->>'activeTimeSeconds')::numeric) as "avgTime"
      from ${t}
      where payload->>'eventType' = 'page_exit'
        and (payload->>'_time')::timestamptz >= '${since}'::timestamptz
      group by payload->>'path'
      having count(*) > 10 and avg((payload->>'maxScrollDepth')::numeric) > 70
      order by avg((payload->>'maxScrollDepth')::numeric) desc
      limit 5
    `,
    bouncePages: `
      select
        payload->>'path' as path,
        count(*) as visits,
        avg((payload->>'activeTimeSeconds')::numeric) as "avgTime",
        avg((payload->>'maxScrollDepth')::numeric) as "avgScroll"
      from ${t}
      where payload->>'eventType' = 'page_exit'
        and (payload->>'_time')::timestamptz >= '${since}'::timestamptz
      group by payload->>'path'
      having count(*) > 5
        and avg((payload->>'activeTimeSeconds')::numeric) < 10
        and avg((payload->>'maxScrollDepth')::numeric) < 25
      order by count(*) desc
      limit 10
    `,
  };

  const results: Record<string, Row[]> = {};

  const entries = Object.entries(queries);
  const settled = await Promise.allSettled(
    entries.map(([, sql]) => queryDatabase(sql))
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

async function generateRecommendations(metrics: Record<string, Row[]>): Promise<string> {
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
