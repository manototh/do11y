#!/usr/bin/env tsx
/**
 * Test runner for QUERIES.md examples.
 *
 * Validates that all APL queries in QUERIES.md are syntactically correct
 * and return data with expected structure and values.
 *
 * Uses credentials from .env in this directory.
 *
 * Run: npx tsx test-queries.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import fs from 'fs';

const AXIOM_DOMAIN = process.env.AXIOM_DOMAIN!;
const AXIOM_TOKEN = process.env.AXIOM_TOKEN!;
const AXIOM_DATASET = process.env.AXIOM_DATASET ?? 'do11y';

if (!AXIOM_DOMAIN || !AXIOM_TOKEN) {
  console.error('Missing AXIOM_DOMAIN or AXIOM_TOKEN in .env');
  process.exit(1);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface QueryExpectation {
  columns: string[];
  validate: (rows: Row[]) => string | null;
}

interface Query {
  section: string;
  subsection: string;
  query: string;
  index: number;
}

interface QueryResult {
  rows: Row[];
  columns: string[];
}

interface Failure {
  name: string;
  query: string;
  error: string;
  rowCount?: number;
  columns?: string[];
}

// ─── Query expectations ─────────────────────────────────────────────────────
// Define expected columns and validation rules for each query by subsection name

const QUERY_EXPECTATIONS: Record<string, QueryExpectation> = {
  'Entry points': {
    columns: ['path', 'entries'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.entries !== 'number' || row.entries < 0) return 'entries should be a non-negative number';
      }
      return null;
    },
  },
  'Traffic sources': {
    columns: ['referrerDomain', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
  'Entry point by referrer': {
    columns: ['referrerDomain', 'path', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
  'AI traffic overview': {
    columns: ['total', 'aiSessions', 'searchSessions', 'directSessions', 'socialSessions', 'communitySessions', 'codeHostSessions', 'otherSessions', 'aiPct'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.total !== 'number' || row.total < 0) return 'total should be a non-negative number';
        if (typeof row.aiSessions !== 'number' || row.aiSessions < 0) return 'aiSessions should be a non-negative number';
        if ((row.aiSessions as number) > (row.total as number)) return 'aiSessions should not exceed total';
      }
      return null;
    },
  },
  'AI traffic by platform': {
    columns: ['aiPlatform', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
  'AI traffic trend': {
    columns: ['week', 'total', 'ai', 'aiPct'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.total !== 'number' || row.total < 0) return 'total should be a non-negative number';
        if (typeof row.ai !== 'number' || row.ai < 0) return 'ai should be a non-negative number';
        if ((row.ai as number) > (row.total as number)) return 'ai should not exceed total';
      }
      return null;
    },
  },
  'Pages discovered via AI': {
    columns: ['path', 'aiPlatform', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
  'AI vs non-AI engagement': {
    columns: ['referrerCategory', 'visits', 'avgTime', 'avgScroll', 'avgEngagement'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
        if (row.avgScroll !== null && ((row.avgScroll as number) < 0 || (row.avgScroll as number) > 100)) {
          return 'avgScroll should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Traffic source breakdown': {
    columns: ['referrerCategory', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
  'Page engagement score': {
    columns: ['path', 'avgActiveTime', 'avgEngagement', 'avgScrollDepth', 'visits', 'engagementScore'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (row.avgScrollDepth !== null && ((row.avgScrollDepth as number) < 0 || (row.avgScrollDepth as number) > 100)) {
          return 'avgScrollDepth should be between 0 and 100';
        }
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
      }
      return null;
    },
  },
  'Scroll completion rate': {
    columns: ['path', 'total', 'completed', 'completionRate'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.total !== 'number' || row.total < 0) return 'total should be a non-negative number';
        if (typeof row.completed !== 'number' || row.completed < 0) return 'completed should be a non-negative number';
        if ((row.completed as number) > (row.total as number)) return 'completed should not exceed total';
        if (row.completionRate !== null && ((row.completionRate as number) < 0 || (row.completionRate as number) > 100)) {
          return 'completionRate should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Bounce detection': {
    columns: ['path', 'avgTime', 'avgScroll', 'visits'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (row.avgTime !== null && (row.avgTime as number) < 0) return 'avgTime should be non-negative';
        if (row.avgScroll !== null && ((row.avgScroll as number) < 0 || (row.avgScroll as number) > 100)) {
          return 'avgScroll should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Exit pages': {
    columns: ['lastPage', 'exits'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.lastPage !== 'string') return 'lastPage should be a string';
        if (typeof row.exits !== 'number' || row.exits < 0) return 'exits should be a non-negative number';
      }
      return null;
    },
  },
  'Low engagement pages': {
    columns: ['path', 'visits', 'avgScroll', 'avgTime'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
      }
      return null;
    },
  },
  'Pages with high search rate': {
    columns: ['path', 'totalViews', 'sessionsWithSearch', 'searchRate'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (row.searchRate !== null && ((row.searchRate as number) < 0 || (row.searchRate as number) > 100)) {
          return 'searchRate should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Page-to-page transitions': {
    columns: ['previousPath', 'path', 'transitions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.transitions !== 'number' || row.transitions < 0) return 'transitions should be a non-negative number';
      }
      return null;
    },
  },
  'Journey depth distribution': {
    columns: ['sessions', 'avgPages', 'medianPages', 'p90Pages'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
        if (row.avgPages !== null && (row.avgPages as number) < 0) return 'avgPages should be non-negative';
      }
      return null;
    },
  },
  'Full session journeys': {
    columns: ['sessionId', 'journey', 'journeyLength'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessionId !== 'string') return 'sessionId should be a string';
        if (!Array.isArray(row.journey)) return 'journey should be an array';
        if (typeof row.journeyLength !== 'number' || row.journeyLength < 0) return 'journeyLength should be a non-negative number';
        if ((row.journey as unknown[]).length !== row.journeyLength) return 'journeyLength should match journey array length';
      }
      return null;
    },
  },
  'Most clicked links': {
    columns: ['linkText', 'targetUrl', 'clicks'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.clicks !== 'number' || row.clicks < 0) return 'clicks should be a non-negative number';
      }
      return null;
    },
  },
  'External link destinations': {
    columns: ['targetUrl', 'clicks'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.clicks !== 'number' || row.clicks < 0) return 'clicks should be a non-negative number';
      }
      return null;
    },
  },
  'Link clicks by section': {
    columns: ['path', 'linkSection', 'clicks'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.clicks !== 'number' || row.clicks < 0) return 'clicks should be a non-negative number';
      }
      return null;
    },
  },
  'Pages with low link engagement': {
    columns: ['path', 'views', 'linkClicks', 'clickRate'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.views !== 'number' || row.views < 0) return 'views should be a non-negative number';
        if (typeof row.linkClicks !== 'number' || row.linkClicks < 0) return 'linkClicks should be a non-negative number';
      }
      return null;
    },
  },
  'Code copy rate by language': {
    columns: ['language', 'copies'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.copies !== 'number' || row.copies < 0) return 'copies should be a non-negative number';
      }
      return null;
    },
  },
  'Code copies by page': {
    columns: ['path', 'codeSection', 'copies'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.copies !== 'number' || row.copies < 0) return 'copies should be a non-negative number';
      }
      return null;
    },
  },
  'Most-read sections': {
    columns: ['path', 'heading', 'readers', 'avgDwell'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.readers !== 'number' || row.readers < 0) return 'readers should be a non-negative number';
        if (row.avgDwell !== null && (row.avgDwell as number) < 0) return 'avgDwell should be non-negative';
      }
      return null;
    },
  },
  'Skipped sections': {
    columns: ['path', 'heading', 'readers', 'avgDwell'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.readers !== 'number' || row.readers < 0) return 'readers should be a non-negative number';
      }
      return null;
    },
  },
  'Most switched-to tabs': {
    columns: ['tabLabel', 'switches'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.switches !== 'number' || row.switches < 0) return 'switches should be a non-negative number';
      }
      return null;
    },
  },
  'Tab switches by page': {
    columns: ['path', 'tabLabel', 'tabGroup', 'switches'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.switches !== 'number' || row.switches < 0) return 'switches should be a non-negative number';
      }
      return null;
    },
  },
  'Most clicked TOC entries': {
    columns: ['path', 'heading', 'clicks'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.clicks !== 'number' || row.clicks < 0) return 'clicks should be a non-negative number';
      }
      return null;
    },
  },
  'Pages with heavy TOC usage': {
    columns: ['path', 'tocClicks', 'views', 'tocRate'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.views !== 'number' || row.views < 0) return 'views should be a non-negative number';
      }
      return null;
    },
  },
  'Feedback by page': {
    columns: ['path', 'total', 'helpful', 'notHelpful', 'helpfulPct'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.total !== 'number' || row.total < 0) return 'total should be a non-negative number';
        if (typeof row.helpful !== 'number' || row.helpful < 0) return 'helpful should be a non-negative number';
        if (typeof row.notHelpful !== 'number' || row.notHelpful < 0) return 'notHelpful should be a non-negative number';
      }
      return null;
    },
  },
  'Most expanded sections': {
    columns: ['path', 'summary', 'expansions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.expansions !== 'number' || row.expansions < 0) return 'expansions should be a non-negative number';
      }
      return null;
    },
  },
  'Expand rate by page': {
    columns: ['path', 'expands', 'views', 'expandRate'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.views !== 'number' || row.views < 0) return 'views should be a non-negative number';
      }
      return null;
    },
  },
  'Page performance dashboard': {
    columns: ['path', 'pageViews', 'avgScrollDepth', 'avgTimeSeconds', 'linkClicks', 'codeCopies', 'searches', 'tocClicks', 'expands', 'clicksPerView', 'copiesPerView'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.pageViews !== 'number' || row.pageViews < 0) return 'pageViews should be a non-negative number';
        if (row.avgScrollDepth !== null && ((row.avgScrollDepth as number) < 0 || (row.avgScrollDepth as number) > 100)) {
          return 'avgScrollDepth should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Compare sections': {
    columns: ['section', 'visits', 'avgTime', 'avgScroll'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
        if (row.avgScroll !== null && ((row.avgScroll as number) < 0 || (row.avgScroll as number) > 100)) {
          return 'avgScroll should be between 0 and 100';
        }
      }
      return null;
    },
  },
  'Week-over-week trend': {
    columns: ['week', 'pageViews', 'uniqueSessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.pageViews !== 'number' || row.pageViews < 0) return 'pageViews should be a non-negative number';
        if (typeof row.uniqueSessions !== 'number' || row.uniqueSessions < 0) return 'uniqueSessions should be a non-negative number';
      }
      return null;
    },
  },
  'Mobile vs desktop engagement': {
    columns: ['deviceType', 'visits', 'avgTime', 'avgScroll'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
      }
      return null;
    },
  },
  'Viewport impact on engagement': {
    columns: ['viewportCategory', 'visits', 'avgScroll'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
      }
      return null;
    },
  },
  'Browser breakdown': {
    columns: ['browserFamily', 'sessions'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.sessions !== 'number' || row.sessions < 0) return 'sessions should be a non-negative number';
      }
      return null;
    },
  },
};

// ─── Parse queries from QUERIES.md ──────────────────────────────────────────

function extractQueries(markdown: string): Query[] {
  const queries: Query[] = [];
  const codeBlockRegex = /```apl\n([\s\S]*?)```/g;

  let currentSection = '';
  let currentSubsection = '';

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const textBefore = markdown.slice(lastIndex, match.index);
    const headerMatches = textBefore.match(/^##+ .+$/gm);
    if (headerMatches) {
      for (const h of headerMatches) {
        if (h.startsWith('## ')) {
          currentSection = h.replace(/^## /, '');
          currentSubsection = '';
        } else if (h.startsWith('### ')) {
          currentSubsection = h.replace(/^### /, '');
        }
      }
    }

    const query = match[1].trim();
    queries.push({
      section: currentSection,
      subsection: currentSubsection,
      query,
      index: queries.length + 1,
    });

    lastIndex = match.index + match[0].length;
  }

  return queries;
}

// ─── Axiom query ────────────────────────────────────────────────────────────

async function runQuery(apl: string): Promise<QueryResult> {
  const adjustedApl = apl.replace(/\['do11y'\]/g, `['${AXIOM_DATASET}']`);

  const body = JSON.stringify({
    apl: adjustedApl,
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date().toISOString(),
  });

  const url = `https://${AXIOM_DOMAIN}/v1/query/_apl?format=tabular`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AXIOM_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    let errorMsg = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      errorMsg = parsed.message ?? parsed.error ?? text;
    } catch { /* ignore */ }
    throw new Error(`${res.status}: ${errorMsg}`);
  }

  let data: {
    tables?: Array<{
      fields?: Array<{ name: string }>;
      columns?: unknown[][];
    }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 200)}`);
  }

  // Parse tabular response into rows
  const table = data.tables?.[0];
  if (table?.fields && table?.columns) {
    const fieldNames = table.fields.map(f => f.name);
    const numRows = table.columns[0]?.length ?? 0;
    const rows: Row[] = [];
    for (let j = 0; j < numRows; j++) {
      const obj: Row = {};
      fieldNames.forEach((name, i) => { obj[name] = table.columns![i]?.[j]; });
      rows.push(obj);
    }
    return { rows, columns: fieldNames };
  }

  return { rows: [], columns: [] };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateResult(queryName: string, result: QueryResult): string[] | null {
  const expectation = QUERY_EXPECTATIONS[queryName];
  if (!expectation) {
    return null; // No expectations defined, skip validation
  }

  const { rows, columns } = result;
  const errors: string[] = [];

  // Check expected columns exist
  for (const col of expectation.columns) {
    if (!columns.includes(col)) {
      errors.push(`Missing expected column: ${col}`);
    }
  }

  // Run value validation if we have rows
  if (rows.length > 0 && expectation.validate) {
    const validationError = expectation.validate(rows);
    if (validationError) {
      errors.push(`Value validation failed: ${validationError}`);
    }
  }

  return errors.length > 0 ? errors : null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Do11y QUERIES.md Test Runner');
  console.log('='.repeat(60));
  console.log(`Axiom domain: ${AXIOM_DOMAIN}`);
  console.log(`Dataset: ${AXIOM_DATASET}`);
  console.log('='.repeat(60));
  console.log();

  const queriesPath = path.resolve(__dirname, '../QUERIES.md');
  if (!fs.existsSync(queriesPath)) {
    console.error(`QUERIES.md not found at ${queriesPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(queriesPath, 'utf-8');
  const queries = extractQueries(markdown);

  console.log(`Found ${queries.length} queries to test\n`);

  let passed = 0;
  let failed = 0;
  const failures: Failure[] = [];

  for (const q of queries) {
    const name = q.subsection || q.section;
    const prefix = `[${q.index}/${queries.length}]`;

    process.stdout.write(`${prefix} ${name}... `);

    try {
      const result = await runQuery(q.query);

      const validationErrors = validateResult(name, result);

      if (validationErrors) {
        console.log(`✗ (validation failed)`);
        for (const err of validationErrors) {
          console.log(`    - ${err}`);
        }
        failed++;
        failures.push({
          name,
          query: q.query,
          error: `Validation errors: ${validationErrors.join('; ')}`,
          rowCount: result.rows.length,
          columns: result.columns,
        });
      } else {
        console.log(`✓ (${result.rows.length} rows, ${result.columns.length} cols)`);
        passed++;
      }
    } catch (err) {
      console.log(`✗`);
      console.log(`    Error: ${(err as Error).message}`);
      failed++;
      failures.push({
        name,
        query: q.query,
        error: (err as Error).message,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('\nFailed queries:\n');
    for (const f of failures) {
      console.log(`--- ${f.name} ---`);
      console.log(`Error: ${f.error}`);
      if (f.columns) {
        console.log(`Columns returned: ${f.columns.join(', ')}`);
      }
      console.log('Query:');
      console.log(f.query);
      console.log();
    }
    process.exit(1);
  }

  console.log('\nAll queries passed!');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
