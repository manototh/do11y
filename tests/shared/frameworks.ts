/**
 * Do11y — shared framework definitions for integration and E2E tests.
 *
 * Provides framework/local-site definitions (FRAMEWORKS),
 * live-site definitions (LIVE_SITES), and dev-server helpers
 * shared by both standalone and instrumentation test suites.
 */

import path from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Framework {
  port: number;
  type: 'npm' | 'pip' | 'static' | 'hugo';
  dir: string;
  staticDir?: string;
  do11yDest: string;
  startCmd?: string;
  startArgs?: string[];
  readyPattern?: RegExp;
  buildCmd?: string;
  startPage: string;
  guidePage: string;
}

export interface DevHandle {
  proc: ChildProcess;
  getOutput: () => string;
}

export interface TestResult {
  skipped?: boolean;
  reason?: string;
  tested?: boolean;
  interactionError?: string;
}

export interface LiveSite {
  startUrl: string;
  secondUrl: string;
}

export interface SupabaseRow {
  payload: {
    eventName?: string;
    testFramework?: string;
    testRunId?: string;
    [key: string]: unknown;
  };
}

// ─── Paths ────────────────────────────────────────────────────────────────────

export const SITES_DIR = path.join(__dirname, '..', 'sites');

// ─── Local test-site definitions ──────────────────────────────────────────────

export const FRAMEWORKS: Record<string, Framework> = {
  mintlify: {
    port: 4005,
    type: 'npm',
    dir: path.join(SITES_DIR, 'mintlify'),
    do11yDest: path.join(SITES_DIR, 'mintlify', 'scripts', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['start'],
    readyPattern: /Ready in|localhost:4005|started/i,
    startPage: '/introduction',
    guidePage: '/guide',
  },
  docusaurus: {
    port: 4001,
    type: 'npm',
    dir: path.join(SITES_DIR, 'docusaurus'),
    do11yDest: path.join(SITES_DIR, 'docusaurus', 'static', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['start'],
    readyPattern: /Docusaurus.*started|localhost:4001/,
    startPage: '/',
    guidePage: '/guide',
  },
  nextra: {
    port: 4002,
    type: 'npm',
    dir: path.join(SITES_DIR, 'nextra'),
    do11yDest: path.join(SITES_DIR, 'nextra', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /Ready in|started server|localhost:4002/,
    startPage: '/',
    guidePage: '/guide',
  },
  vitepress: {
    port: 4003,
    type: 'npm',
    dir: path.join(SITES_DIR, 'vitepress'),
    do11yDest: path.join(SITES_DIR, 'vitepress', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /vitepress.*started|localhost:4003/i,
    startPage: '/',
    guidePage: '/guide',
  },
  'mkdocs-material': {
    port: 4004,
    type: 'pip',
    dir: path.join(SITES_DIR, 'mkdocs-material'),
    do11yDest: path.join(SITES_DIR, 'mkdocs-material', 'docs', 'do11y.js'),
    startCmd: 'mkdocs',
    startArgs: ['serve', '--dev-addr', '127.0.0.1:4004', '--no-livereload'],
    readyPattern: /Serving on|Start watching|localhost:4004/,
    startPage: '/',
    guidePage: '/guide/',
  },
  starlight: {
    port: 4006,
    type: 'npm',
    dir: path.join(SITES_DIR, 'starlight'),
    do11yDest: path.join(SITES_DIR, 'starlight', 'public', 'do11y.js'),
    startCmd: 'npm',
    startArgs: ['run', 'start'],
    readyPattern: /astro.*started|localhost:4006/i,
    startPage: '/',
    guidePage: '/guide/',
  },
  docsy: {
    port: 4007,
    type: 'hugo',
    dir: path.join(SITES_DIR, 'docsy'),
    do11yDest: path.join(SITES_DIR, 'docsy', 'static', 'do11y.js'),
    startCmd: 'hugo',
    startArgs: ['server', '-p', '4007', '--bind', '127.0.0.1', '--disableLiveReload', '-D'],
    readyPattern: /localhost:4007|Web Server|watching/i,
    startPage: '/docs/',
    guidePage: '/docs/guide/',
  },
};

// ─── Live site definitions ────────────────────────────────────────────────────

export const LIVE_SITES: Record<string, LiveSite> = {
  mintlify: {
    startUrl:  'https://www.mintlify.com/docs/components/expandables',
    secondUrl: 'https://www.mintlify.com/docs/components/accordions',
  },
  docusaurus: {
    startUrl:  'https://docusaurus.io/docs/next/swizzling',
    secondUrl: 'https://docusaurus.io/docs/next/markdown-features',
  },
  nextra: {
    startUrl:  'https://nextra.site/docs/docs-theme/start',
    secondUrl: 'https://nextra.site/docs',
  },
  'mkdocs-material': {
    startUrl:  'https://squidfunk.github.io/mkdocs-material/reference/admonitions',
    secondUrl: 'https://squidfunk.github.io/mkdocs-material/reference/icons-emojis/',
  },
  vitepress: {
    startUrl:  'https://vitepress.dev/guide/getting-started',
    secondUrl: 'https://vitepress.dev/guide/markdown',
  },
  starlight: {
    startUrl:  'https://starlight.astro.build/getting-started/',
    secondUrl: 'https://starlight.astro.build/guides/pages/',
  },
  'docsy-dev': {
    startUrl:  'https://www.docsy.dev/docs/content/iconsimages/',
    secondUrl: 'https://www.docsy.dev/docs/content/lookandfeel/',
  },
  'docsy-otel': {
    startUrl:  'https://opentelemetry.io/docs/languages/js/getting-started/nodejs/',
    secondUrl: 'https://opentelemetry.io/docs/languages/js/getting-started/browser/',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function log(msg: string): void { console.log(`\x1b[36m[runner]\x1b[0m ${msg}`); }
export function warn(msg: string): void { console.log(`\x1b[33m[runner]\x1b[0m ${msg}`); }
export function fail(msg: string): void { console.log(`\x1b[31m[runner]\x1b[0m ${msg}`); }

export function waitForServer(port: number, timeoutMs = 180000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check(): void {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server on port ${port} did not start within ${timeoutMs}ms`));
      }
      const req = http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        if (res.statusCode! < 500) resolve();
        else setTimeout(check, 500);
      });
      req.on('error', () => setTimeout(check, 500));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 500); });
    }
    check();
  });
}

export function startStaticServer(dir: string, port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url!);
      if (!path.extname(filePath)) filePath += '.html';
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        const types: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
        };
        res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

export function killProc(proc: ChildProcess): void {
  try { process.kill(-proc.pid!, 'SIGTERM'); } catch { /* ignore */ }
  try { proc.kill('SIGTERM'); } catch { /* ignore */ }
}

export function getPythonUserBins(): string[] {
  const dirs = new Set<string>();
  for (const cmd of ['python3 -m site --user-base', 'python -m site --user-base']) {
    try {
      const base = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (base) dirs.add(path.join(base, 'bin'));
    } catch { /* ignore */ }
  }
  const pyLibDir = path.join(process.env.HOME ?? '', 'Library', 'Python');
  try {
    for (const ver of fs.readdirSync(pyLibDir)) {
      dirs.add(path.join(pyLibDir, ver, 'bin'));
    }
  } catch { /* ignore */ }
  return [...dirs];
}

export function startDevServer(fw: Framework): DevHandle {
  const env: NodeJS.ProcessEnv = { ...process.env, BROWSER: 'none', NODE_ENV: 'development' };
  if (fw.type === 'pip') {
    const extraPath = getPythonUserBins().join(':');
    if (extraPath) env.PATH = extraPath + ':' + (env.PATH ?? '');
  } else if (fw.type === 'hugo') {
    const binDir = path.join(fw.dir, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      env.PATH = binDir + ':' + (env.PATH ?? '');
    }
  }
  const proc = spawn(fw.startCmd!, fw.startArgs!, {
    cwd: fw.dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  let output = '';
  proc.stdout!.on('data', (d: Buffer) => { output += d.toString(); });
  proc.stderr!.on('data', (d: Buffer) => { output += d.toString(); });
  proc.on('error', (err: Error) => { fail(`  Server process error: ${err.message}`); });
  return { proc, getOutput: () => output };
}
