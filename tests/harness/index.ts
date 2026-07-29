/**
 * Do11y — Test harness for instrumentation tests.
 *
 * This is a small IIFE bundle that sets up an OpenTelemetry LoggerProvider
 * with a Supabase-backed LogRecordExporter, then enables DocsInstrumentation.
 * Events are sent to a Supabase table for test validation via REST API query.
 *
 * Built by rolldown → tests/harness/do11y-test-harness.js
 *
 * The test runner calls __do11yTestSetConfig() with framework, Supabase
 * credentials, and test-run metadata, then __do11yTestInit() to bootstrap.
 * No in-memory exporter — validation is always via Supabase query.
 *
 * Window API exposed to test runners:
 *   __do11yTestSetConfig(c) → void  (set config before init)
 *   __do11yTestInit()       → void  (teardown + setup with current config)
 *   __do11yTestReset()      → void  (re-init with same config)
 */

import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { DocsInstrumentation } from '../../src/instrumentation/index.js';
import type { DocsInstrumentationConfig } from '../../src/instrumentation/config.js';
import { emitPageExit, resetEngagementState } from '../../src/core/tracking/engagement.js';
import { getBrowserContext, getPageInfo } from '../../src/core/context.js';
import type { EmitFn, Do11yConfig } from '../../src/core/types.js';
import { VERSION } from '../../src/core/constants.js';

// ─── Supabase LogRecord exporter (test-only) ────────────────────────────────

class SupabaseLogRecordExporter {
  private url: string;
  private headers: Record<string, string>;
  private testRunId: string | undefined;
  private testFramework: string | undefined;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    table: string,
    testRunId?: string,
    testFramework?: string,
  ) {
    this.url = `${supabaseUrl}/rest/v1/${table}`;
    this.headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };
    this.testRunId = testRunId;
    this.testFramework = testFramework;
  }

  export(logRecords: any[], resultCallback: (result: { code: number }) => void): void {
    const payloads = logRecords.map(record => {
      const payload: Record<string, unknown> = {
        eventName: record.eventName,
        ...record.attributes,
      };
      if (this.testRunId) payload._testRunId = this.testRunId;
      if (this.testFramework) payload._testFramework = this.testFramework;
      return { payload };
    });
    const body = JSON.stringify(payloads);

    // Use synchronous XMLHttpRequest so the request completes even during
    // beforeunload / page teardown. Fetch with keepalive is not reliable
    // enough for the last event emitted during page close.
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.url, false); // synchronous
      for (const [key, val] of Object.entries(this.headers)) {
        xhr.setRequestHeader(key, val);
      }
      xhr.send(body);
      resultCallback({ code: xhr.status >= 200 && xhr.status < 300 ? 0 : 1 });
    } catch {
      resultCallback({ code: 1 }); // ExportResultCode.FAILED
    }
  }

  async flush(): Promise<void> {
    // All requests are synchronous — no pending fetches to await.
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// ─── Extended config type (harness-only, not in production types) ────────────

interface TestHarnessConfig extends DocsInstrumentationConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseTable?: string;
  testRunId?: string;
  testFramework?: string;
}

// ─── Module-level state ──────────────────────────────────────────────────────

let instrumentation: DocsInstrumentation | null = null;
let harnessConfig: TestHarnessConfig = {};
let supabaseExporter: SupabaseLogRecordExporter | null = null;
let loggerProvider: LoggerProvider | null = null;
let harnessEmit: EmitFn | null = null;

// ─── Setup / teardown ───────────────────────────────────────────────────────

function setup(): void {
  supabaseExporter = new SupabaseLogRecordExporter(
    harnessConfig.supabaseUrl!,
    harnessConfig.supabaseKey!,
    harnessConfig.supabaseTable ?? 'do11y_events',
    harnessConfig.testRunId,
    harnessConfig.testFramework,
  );

  loggerProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor({ exporter: supabaseExporter })],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  // Create a separate emit function that harness code can use directly.
  // This mirrors what DocsInstrumentation.enable() does internally, but is
  // accessible from the harness for test-time event emission (e.g. page_exit).
  const logger = logs.getLogger('@manototh/do11y');
  harnessEmit = (eventName, eventData) => {
    logger.emit({
      eventName,
      severityNumber: 9,
      attributes: {
        'browser.do11y.version': '0.2.0',
        ...getBrowserContext(),
        ...getPageInfo(),
        ...eventData,
      },
      body: '',
    });
  };

  instrumentation = new DocsInstrumentation(harnessConfig);
  instrumentation.enable();
}

function teardown(): void {
  if (instrumentation) {
    instrumentation.disable();
    instrumentation = null;
  }
  loggerProvider = null;
  supabaseExporter = null;
}

// ─── Window API ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __do11yTestSetConfig(c: TestHarnessConfig): void;
    __do11yTestInit(): void;
    __do11yTestReset(): void;
    /** Emit page_exit using the same core logic as the tracking modules. */
    __do11yTestEmitPageExit(): void;
    /** Returns 'ok' if booted, 'not-booted' if not, or error string. */
    __do11yTestDidBoot(): string;
  }
}

window.__do11yTestSetConfig = function (c: TestHarnessConfig) {
  harnessConfig = c;
};

window.__do11yTestInit = function () {
  teardown();
  try {
    setup();
  } catch (err) {
    _bootError = String(err);
    console.error('[Do11y Harness] setup() failed:', err);
  }
};

// Debug: expose whether the current page booted DocsInstrumentation,
// and any error that occurred during init.
let _bootError: string | null = null;
window.__do11yTestDidBoot = function (): string | null {
  return _bootError || (instrumentation !== null ? 'ok' : 'not-booted');
};

window.__do11yTestReset = function () {
  teardown();
  setup();
};

/**
 * Emit page_exit event using the existing harness emit function.
 * Test runners call this before closing the page to ensure the exit event
 * is captured. The sync XHR exporter guarantees delivery.
 */
window.__do11yTestEmitPageExit = function () {
  if (harnessEmit) {
    emitPageExit(harnessConfig as unknown as Do11yConfig, harnessEmit);
  }
};

// Note: No auto-start. The test runner must call __do11yTestSetConfig() then
// __do11yTestInit() so that config is applied before DocsInstrumentation boots.
