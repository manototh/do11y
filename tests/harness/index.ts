/**
 * Do11y — Test harness for instrumentation tests.
 *
 * This is a small IIFE bundle that sets up an OpenTelemetry LoggerProvider
 * with an InMemoryLogRecordExporter, then enables DocsInstrumentation.
 * Events are captured in-memory and exposed to Puppeteer via window globals.
 *
 * Built by rolldown → tests/harness/do11y-test-harness.js
 *
 * Window API exposed to test runners:
 *   __do11yTestGetEvents()  → LogRecord[]
 *   __do11yTestReset()      → void
 *   __do11yTestSetConfig(c) → void  (set DocsInstrumentationConfig before enable)
 */

import { LoggerProvider, SimpleLogRecordProcessor, InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { DocsInstrumentation } from '../../src/instrumentation/index.js';
import type { DocsInstrumentationConfig } from '../../src/instrumentation/config.js';

// ─── Module-level state ──────────────────────────────────────────────────────

const exporter = new InMemoryLogRecordExporter();
let instrumentation: DocsInstrumentation | null = null;
let config: DocsInstrumentationConfig = {};

// ─── Setup ───────────────────────────────────────────────────────────────────

function setup(): void {
  // Create LoggerProvider with in-memory exporter
  const loggerProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor({ exporter })],
  });

  // Set as global provider so logs.getLogger() uses it
  logs.setGlobalLoggerProvider(loggerProvider);

  // Create and enable instrumentation
  instrumentation = new DocsInstrumentation(config);
  instrumentation.enable();
}

function teardown(): void {
  if (instrumentation) {
    instrumentation.disable();
    instrumentation = null;
  }
  exporter.reset();
}

// ─── Window API ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __do11yTestGetEvents(): ReturnType<InMemoryLogRecordExporter['getFinishedLogRecords']>;
    __do11yTestReset(): void;
    __do11yTestSetConfig(c: DocsInstrumentationConfig): void;
  }
}

window.__do11yTestGetEvents = function () {
  return exporter.getFinishedLogRecords();
};

window.__do11yTestReset = function () {
  teardown();
  setup();
};

window.__do11yTestSetConfig = function (c: DocsInstrumentationConfig) {
  config = c;
};

// ─── Auto-start ──────────────────────────────────────────────────────────────

setup();
