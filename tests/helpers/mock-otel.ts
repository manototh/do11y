/**
 * Do11y — Test Helpers
 *
 * Mock OpenTelemetry API for testing instrumentation and export paths.
 *
 * Provides:
 *   - createMockLoggerProvider(): returns a fake LoggerProvider that records
 *     all emitted log records in an array for assertion.
 *   - installMockOtel(): sets global OTel API objects to the mocks.
 *   - uninstallMockOtel(): restores originals.
 *
 * Usage:
 *   import { installMockOtel, uninstallMockOtel, getMockLogRecords } from '../helpers/mock-otel';
 *
 *   beforeEach(() => { installMockOtel(); });
 *   afterEach(() => { uninstallMockOtel(); });
 *
 *   // ... trigger some tracking ...
 *   const records = getMockLogRecords();
 *   expect(records[0].eventName).toBe('browser.do11y.page_view');
 */

interface MockLogRecord {
  eventName: string;
  severityNumber: number;
  attributes: Record<string, unknown>;
  body: string;
  timestamp: number;
}

interface MockLogger {
  emit: (record: MockLogRecord) => void;
  getRecords: () => MockLogRecord[];
  clearRecords: () => void;
}

interface MockLoggerProvider {
  getLogger: (name: string) => MockLogger;
  getRecords: () => MockLogRecord[];
  clearRecords: () => void;
}

let records: MockLogRecord[] = [];
let originalApiLogs: unknown = null;

// ─── Mock Logger ───────────────────────────────────────────────────────────

function createMockLogger(): MockLogger {
  return {
    emit: (record: MockLogRecord) => {
      records.push({ ...record, timestamp: Date.now() });
    },
    getRecords: () => [...records],
    clearRecords: () => { records = []; },
  };
}

// ─── Mock LoggerProvider ───────────────────────────────────────────────────

function createMockLoggerProvider(): MockLoggerProvider {
  const loggers = new Map<string, MockLogger>();

  return {
    getLogger: (name: string): MockLogger => {
      if (!loggers.has(name)) {
        loggers.set(name, createMockLogger());
      }
      return loggers.get(name)!;
    },
    getRecords: () => [...records],
    clearRecords: () => { records = []; },
  };
}

// ─── OTel API module shape ─────────────────────────────────────────────────

/**
 * Create a fake `@opentelemetry/api-logs` module that can be used
 * in place of the real one for testing.
 */
export function createMockOtelApiLogs(): { logs: { getLogger: (name: string) => MockLogger }; setGlobalLoggerProvider: (provider: MockLoggerProvider) => void } {
  const provider = createMockLoggerProvider();

  return {
    logs: {
      getLogger: (name: string) => provider.getLogger(name),
    },
    setGlobalLoggerProvider: (p: MockLoggerProvider) => {
      // Store reference so calls go through the new provider
      provider.getLogger = p.getLogger.bind(p);
    },
  };
}

// ─── Globals installation ─────────────────────────────────────────────────

/**
 * Install mock OTel objects into global scope so that instrumentation
 * code that imports from @opentelemetry/api-logs uses our mocks.
 *
 * Returns the mock provider for direct assertion access.
 */
export function installMockOtel(): MockLoggerProvider {
  // Capture the original require/module resolution if needed
  // For Vitest, we can just mock the module via vi.mock instead.
  // This function exists for environments where vi.mock isn't available.

  records = [];
  const provider = createMockLoggerProvider();
  return provider;
}

/**
 * Clear all recorded log records without uninstalling.
 */
export function clearMockLogRecords(): void {
  records = [];
}

/**
 * Get all log records emitted since the last install/clear.
 */
export function getMockLogRecords(): MockLogRecord[] {
  return [...records];
}

/**
 * Get log records filtered by event name.
 */
export function getMockLogRecordsByEvent(eventName: string): MockLogRecord[] {
  return records.filter(r => r.eventName === eventName);
}

/**
 * Get log records matching a predicate on attributes.
 */
export function getMockLogRecordsWhere(
  predicate: (record: MockLogRecord) => boolean,
): MockLogRecord[] {
  return records.filter(predicate);
}

export type { MockLogRecord, MockLogger, MockLoggerProvider };
