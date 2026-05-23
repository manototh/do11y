#!/usr/bin/env tsx
/**
 * Test runner for queries.md examples.
 *
 * Validates that all PostgreSQL queries in queries.md are syntactically correct
 * and return data with expected structure and values.
 *
 * Uses credentials from .env in this directory.
 *
 * Run: npx tsx test-queries.ts
 *
 * Required (set in .env):
 *   SUPABASE_URL        — Supabase project URL
 *   SUPABASE_SECRET_KEY — Secret key (sb_secret_...) for querying via PostgREST
 *   DATABASE_URL        — Direct Postgres connection string (for running raw SQL)
 *
 * The DATABASE_URL is needed because PostgREST doesn't support raw SQL queries.
 * Find it in Supabase dashboard: Settings > Database > Connection string (URI).
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env');
  console.error('Find it in Supabase dashboard: Settings > Database > Connection string');
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
      }
      return null;
    },
  },
  'Bounce detection': {
    columns: ['path', 'avgTime', 'avgScroll', 'visits'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.path !== 'string') return 'path should be a string';
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
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
      }
      return null;
    },
  },
  'Compare sections': {
    columns: ['section', 'visits', 'avgTime', 'avgScroll'],
    validate: (rows) => {
      for (const row of rows) {
        if (typeof row.visits !== 'number' || row.visits < 0) return 'visits should be a non-negative number';
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

// ─── Parse queries from queries.md ──────────────────────────────────────────

function extractQueries(markdown: string): Query[] {
  const queries: Query[] = [];
  const codeBlockRegex = /```sql\n([\s\S]*?)```/g;

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

// ─── PostgreSQL query ───────────────────────────────────────────────────────

async function runQuery(client: pg.Client, sql: string): Promise<QueryResult> {
  const result = await client.query(sql);
  const columns = result.fields.map(f => f.name);

  const rows: Row[] = result.rows.map(row => {
    const typed: Row = {};
    for (const col of columns) {
      const val = row[col];
      if (typeof val === 'string' && /^\d+$/.test(val)) {
        typed[col] = parseInt(val, 10);
      } else if (typeof val === 'string' && /^\d+\.\d+$/.test(val)) {
        typed[col] = parseFloat(val);
      } else {
        typed[col] = val;
      }
    }
    return typed;
  });

  return { rows, columns };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateResult(queryName: string, result: QueryResult): string[] | null {
  const expectation = QUERY_EXPECTATIONS[queryName];
  if (!expectation) {
    return null;
  }

  const { rows, columns } = result;
  const errors: string[] = [];

  for (const col of expectation.columns) {
    // PostgreSQL returns lowercase column names; check case-insensitively
    const found = columns.some(c => c.toLowerCase() === col.toLowerCase());
    if (!found) {
      errors.push(`Missing expected column: ${col} (got: ${columns.join(', ')})`);
    }
  }

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
  console.log('Do11y queries.md Test Runner');
  console.log('='.repeat(60));
  console.log(`Database: ${DATABASE_URL!.replace(/:[^:@]+@/, ':***@')}`);
  console.log('='.repeat(60));
  console.log();

  const queriesPath = path.resolve(__dirname, '../docs/queries.md');
  if (!fs.existsSync(queriesPath)) {
    console.error(`queries.md not found at ${queriesPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(queriesPath, 'utf-8');
  const queries = extractQueries(markdown);

  console.log(`Found ${queries.length} queries to test\n`);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  let passed = 0;
  let failed = 0;
  const failures: Failure[] = [];

  for (const q of queries) {
    const name = q.subsection || q.section;
    const prefix = `[${q.index}/${queries.length}]`;

    process.stdout.write(`${prefix} ${name}... `);

    try {
      const result = await runQuery(client, q.query);

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

    await new Promise(r => setTimeout(r, 50));
  }

  await client.end();

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
