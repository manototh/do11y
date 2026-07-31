/**
 * Do11y — Documentation Observability
 *
 * Standalone transport layer.
 *
 * Handles event batching, HTTP/Supabase/OTLP sending, retries, and
 * synchronous flush on page unload. Only used by the standalone IIFE build.
 */
import type { Do11yEvent, Do11yConfig } from "../core/types.js";
import {
  VERSION,
  ATTR_SESSION_ID,
  ATTR_DO11Y_SESSION_PAGE_COUNT,
  ATTR_DO11Y_DO11Y_VERSION,
  ATTR_DO11Y_SCROLL_THRESHOLD,
} from "../core/constants.js";
import { getSession } from "../core/session.js";
import { getPageInfo } from "../core/context.js";
import { getBrowserContext } from "../core/context.js";

// ─── Module-level state ──────────────────────────────────────────────────────

export let eventQueue: Do11yEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const lastEventTime: Record<string, number> = {};
let isDisabled = false;
let _otelLogger: {
  emit: (record: {
    eventName: string;
    severityNumber: number;
    attributes: Record<string, unknown>;
    body: string;
  }) => void;
} | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

export function setIsDisabled(v: boolean): void {
  isDisabled = v;
}
export function getIsDisabled(): boolean {
  return isDisabled;
}
export function getQueueLength(): number {
  return eventQueue.length;
}

/** @internal Test-only — inject a mock OTel logger for envelope tests. */
export function __testing_setOtelLogger(logger: typeof _otelLogger): void {
  _otelLogger = logger;
}
export function getOtelLogger(): typeof _otelLogger {
  return _otelLogger;
}

/** Reset all module-level state to initial values. Used by tests. */
export function resetTransportState(): void {
  eventQueue = [];
  flushTimeout = null;
  for (const key of Object.keys(lastEventTime)) delete lastEventTime[key];
  isDisabled = false;
  _otelLogger = null;
}

// ─── Queue & Flush ───────────────────────────────────────────────────────────

export function queueEvent(
  config: Do11yConfig,
  eventName: string,
  eventData: Record<string, unknown>,
): void {
  if (isDisabled) return;

  const now = Date.now();

  // Rate-limit per event type, but let distinct scroll milestones through:
  // a fast scroll can cross several thresholds in a single frame, which
  // would otherwise drop all but the first milestone. Key on the threshold
  // attribute when present so each milestone is rate-limited independently.
  const rateKey =
    eventData[ATTR_DO11Y_SCROLL_THRESHOLD] !== null &&
    eventData[ATTR_DO11Y_SCROLL_THRESHOLD] !== undefined
      ? `${eventName}:${String(eventData[ATTR_DO11Y_SCROLL_THRESHOLD])}`
      : eventName;

  if (config.rateLimitMs > 0 && lastEventTime[rateKey]) {
    if (now - lastEventTime[rateKey] < config.rateLimitMs) {
      if (config.debug) {
        console.log("[Do11y] Rate limited:", eventName);
      }
      return;
    }
  }
  lastEventTime[rateKey] = now;

  const session = getSession();

  // Build event with OTel semantic convention attribute keys
  const event: Record<string, unknown> = {
    _time: new Date().toISOString(),
    eventName,
    [ATTR_DO11Y_DO11Y_VERSION]: VERSION,
    [ATTR_SESSION_ID]: session.id,
    [ATTR_DO11Y_SESSION_PAGE_COUNT]: session.pageCount,
    ...getPageInfo(),
    ...getBrowserContext(),
    ...eventData,
  };

  if (config.debug) {
    console.log("[Do11y] Event queued:", eventName, event);
  }

  // In OTLP mode, emit directly through the OTel SDK.
  // Lazy-init the SDK on first use if it hasn't been loaded yet.
  if (config.destination === "otlp") {
    if (!_otelLogger) {
      initOtelSdk(config).catch((err) => {
        console.warn("[Do11y] OTel SDK initialization failed:", err);
      });
    }
    if (_otelLogger) {
      _otelLogger.emit({
        eventName,
        severityNumber: 9, // SEVERITY_NUMBER_INFO
        attributes: event,
        body: "",
      });
      return;
    }
  }

  // In HTTP/Supabase mode, queue for batching
  // The event object is built with all required Do11yEvent fields above;
  // the cast is safe because the Record contains every Do11yEvent key.
  eventQueue.push(event as Do11yEvent);

  if (eventQueue.length > 500) {
    eventQueue = eventQueue.slice(-500);
    console.warn("[Do11y] Event queue capped at 500 events — oldest events dropped");
  }

  if (eventQueue.length >= config.maxBatchSize) {
    flush(config);
  } else {
    scheduleFlush(config);
  }
}

function scheduleFlush(config: Do11yConfig): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => flush(config), config.flushInterval);
}

// ─── Config Validation ───────────────────────────────────────────────────────

function validateSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname.endsWith(".supabase.co")) return false;
    return true;
  } catch {
    return false;
  }
}

function validateEndpoint(url: string, debug = false): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isPrivate =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host);
    // Allow HTTP for private addresses when debug is enabled (dev/test usage)
    if (debug && isPrivate && parsed.protocol === "http:") return true;
    if (parsed.protocol !== "https:") return false;
    if (isPrivate) return false;
    return true;
  } catch {
    return false;
  }
}

export function validateConfig(config: Do11yConfig): boolean {
  if (config.destination === "supabase") {
    if (!config.supabaseUrl) {
      if (config.debug) console.warn("[Do11y] No Supabase URL configured");
      return false;
    }
    if (!validateSupabaseUrl(config.supabaseUrl)) {
      if (config.debug)
        console.warn("[Do11y] Invalid Supabase URL. Must be https://<project>.supabase.co");
      return false;
    }
    if (
      !config.supabaseKey ||
      typeof config.supabaseKey !== "string" ||
      config.supabaseKey.length < 10
    ) {
      if (config.debug) console.warn("[Do11y] Invalid or missing Supabase publishable key");
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(config.supabaseTable)) {
      if (config.debug) console.warn("[Do11y] Invalid table name");
      return false;
    }
    return true;
  }

  if (config.destination === "http") {
    if (!config.endpoint) {
      if (config.debug) console.warn("[Do11y] No HTTP endpoint configured");
      return false;
    }
    if (!validateEndpoint(config.endpoint, config.debug)) {
      if (config.debug)
        console.warn("[Do11y] Invalid HTTP endpoint. Must be HTTPS and not a private address.");
      return false;
    }
    return true;
  }

  if (config.destination === "otlp") {
    if (!config.otelSdkEndpoint) {
      if (config.debug) console.warn("[Do11y] No OTLP endpoint configured");
      return false;
    }
    return true;
  }

  if (config.debug) console.warn("[Do11y] Unknown destination:", config.destination);
  return false;
}

// ─── OTel SDK (CDN dynamic import) ───────────────────────────────────────────

/**
 * Dynamically import the OTel Browser SDK and set up the LoggerProvider.
 * Only called when destination is 'otlp'.
 */
/** CDN base URL for dynamic OTel SDK imports. Pinned at build time.
 *  Change this constant (not a config field) to switch CDN providers. */
const OTEL_CDN_BASE = "https://esm.sh/";

async function initOtelSdk(config: Do11yConfig): Promise<void> {
  if (_otelLogger) return; // already initialized

  const cdnBase = OTEL_CDN_BASE;
  const apiLogs = await import(/* @vite-ignore */ `${cdnBase}@opentelemetry/api-logs`);
  const sdkLogs = await import(/* @vite-ignore */ `${cdnBase}@opentelemetry/sdk-logs`);
  const otlpExporter = await import(
    /* @vite-ignore */ `${cdnBase}@opentelemetry/exporter-logs-otlp-http`
  );

  const resourceAttrs: Record<string, string> = {
    "service.name": config.otelSdkServiceName || "do11y",
    "service.version": VERSION,
    "telemetry.sdk.name": "do11y",
    "telemetry.sdk.language": "webjs",
    "telemetry.sdk.version": VERSION,
    ...config.otelSdkResourceAttributes,
  };

  const loggerProvider = new sdkLogs.LoggerProvider({
    resource: {
      attributes: resourceAttrs,
    },
    processors: [
      new sdkLogs.BatchLogRecordProcessor({
        exporter: new otlpExporter.OTLPLogExporter({
          url: config.otelSdkEndpoint.replace(/\/$/, "") + "/v1/logs",
          headers: config.otelSdkHeaders,
        }),
      }),
    ],
  });

  apiLogs.logs.setGlobalLoggerProvider(loggerProvider);
  _otelLogger = loggerProvider.getLogger("do11y");

  if (config.debug) {
    console.log("[Do11y] OTel SDK initialized with endpoint:", config.otelSdkEndpoint);
  }
}

// ─── HTTP Transport ──────────────────────────────────────────────────────────

function buildRequest(
  events: Do11yEvent[],
  config: Do11yConfig,
): { url: string; headers: Record<string, string>; body: string } {
  if (config.destination === "supabase") {
    const url = config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + config.supabaseTable;
    const bodyTransform =
      config.bodyTransform ?? ((evts: object[]) => (evts as object[]).map((e) => ({ payload: e })));
    return {
      url,
      headers: {
        apikey: config.supabaseKey,
        Authorization: "Bearer " + config.supabaseKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(bodyTransform(events)),
    };
  }

  // http destination
  const bodyTransform = config.bodyTransform ?? ((evts: object[]) => evts);
  return {
    url: config.endpoint,
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify(bodyTransform(events)),
  };
}

function isCrossOrigin(url: string): boolean {
  try {
    const reqUrl = new URL(url);
    return reqUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function sendEvents(
  req: { url: string; headers: Record<string, string>; body: string },
  events: Do11yEvent[],
  retriesLeft: number,
  config: Do11yConfig,
): void {
  const crossOrigin = isCrossOrigin(req.url);

  if (config.debug && crossOrigin) {
    console.log(
      "[Do11y] Cross-origin request to",
      new URL(req.url).origin,
      "- requires CORS headers on the server",
    );
  }

  fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: req.body,
    keepalive: true,
    mode: crossOrigin ? "cors" : "same-origin",
  })
    .then((response) => {
      if (response.ok) {
        if (config.debug) console.log("[Do11y] Flushed", events.length, "events");
        return;
      }

      if (retriesLeft > 0 && (response.status >= 500 || response.status === 429)) {
        if (config.debug) console.log("[Do11y] Retrying after error:", response.status);
        eventQueue = events.concat(eventQueue);
        setTimeout(
          () => flush(config, retriesLeft - 1),
          config.retryDelay * (config.maxRetries - retriesLeft + 1),
        );
        return;
      }

      if (config.debug) {
        response
          .text()
          .then((text) => {
            const msg = `[Do11y] Ingest failed: ${response.status}`;
            if (response.status === 0 && response.type === "opaque") {
              console.error(msg, "- CORS error: server did not return Access-Control-Allow-Origin");
            } else {
              console.error(msg, text);
            }
          })
          .catch(() => {
            /* ignore */
          });
      }
    })
    .catch((err: Error) => {
      if (retriesLeft > 0) {
        if (config.debug) {
          const hint = crossOrigin
            ? " (this may be a CORS issue — try using an OTel Collector proxy)"
            : "";
          console.log("[Do11y] Network error, retrying:", err.message + hint);
        }
        eventQueue = events.concat(eventQueue);
        setTimeout(
          () => flush(config, retriesLeft - 1),
          config.retryDelay * (config.maxRetries - retriesLeft + 1),
        );
      } else if (config.debug) {
        console.error("[Do11y] Failed to send events:", err.message);
      }
    });
}

export function flush(config: Do11yConfig, retriesLeft?: number): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) return;
  if (!validateConfig(config)) return;

  const retries = typeof retriesLeft === "number" ? retriesLeft : config.maxRetries;
  const events = eventQueue.slice();
  eventQueue = [];

  const req = buildRequest(events, config);
  sendEvents(req, events, retries, config);
}

/**
 * Synchronous flush used on `beforeunload`. For OTLP mode the SDK
 * handles flush on its own; for HTTP/Supabase we use fetch with keepalive.
 * sendBeacon is not used because Supabase requires custom headers
 * (apikey, Authorization) which sendBeacon does not support.
 */
export function flushSync(config: Do11yConfig): void {
  if (config.destination === "otlp") {
    return; // OTel SDK handles unload flushing
  }

  if (eventQueue.length === 0) return;
  if (!validateConfig(config)) return;

  const events = eventQueue;
  eventQueue = [];

  const req = buildRequest(events, config);

  try {
    fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      keepalive: true,
    });
  } catch {
    // Best effort - ignore errors on page unload
  }

  if (config.debug) {
    console.log("[Do11y] Sync flushed", events.length, "events");
  }
}

export function cleanup(): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}
