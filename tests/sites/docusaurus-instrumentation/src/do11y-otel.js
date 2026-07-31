/**
 * Do11y + OpenTelemetry Browser SDK — client-side integration for this
 * Docusaurus site.
 *
 * This module (loaded via the local `do11y-otel-plugin`) is where Do11y's
 * `DocsInstrumentation` is layered on top of the OpenTelemetry Browser SDK, so
 * every docs-specific behaviour — page views, scroll depth, code copies, TOC
 * clicks, tab switches, feedback, search — flows through the same OTLP
 * pipeline as the browser's own telemetry (Web Vitals, navigation timing,
 * resource timing, user actions).
 *
 * Ordering matters (this is the setup documented in docs/get-started.md):
 *   1. Start the Browser SDK FIRST — it registers the global LoggerProvider.
 *   2. THEN register instrumentations, Do11y's `DocsInstrumentation` included.
 * `DocsInstrumentation` resolves the logger lazily per event, so records
 * emitted after the SDK is started still land in the right provider.
 */
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocsInstrumentation } from '@manototh/do11y/instrumentation';

/**
 * Local OTel Collector. The Browser SDK expects the FULL signal URL (it does
 * not append `/v1/logs` itself). Browser exports need CORS enabled on the
 * collector.
 */
const OTLP_ENDPOINT = 'https://do11y-otel-proxy.manototh.workers.dev';

// Client modules only ever run in the browser, but guard anyway so the module
// is safe to import in any environment.
if (typeof window !== 'undefined') {
  void boot();
}

async function boot() {
  // Verbose OTel diagnostics come from `logLevel: 'DEBUG'` on the Browser SDK
  // below — it registers a DiagConsoleLogger for us, so every emit and export
  // shows up in the console while we wire the new instrumentation layer.

  // ── Sessions ─────────────────────────────────────────────────────────────
  // Sessions correlate every do11y event and browser span with a stable
  // `session.id` across page loads. The session processors MUST be listed
  // before the export processors so the attribute is attached before export.
  const sessionManager = createSessionManager({
    sessionIdGenerator: createDefaultSessionIdGenerator(),
    sessionStore: createLocalStorageSessionStore(),
    // 4h ceiling, 30min of inactivity rotates the session.
    maxDuration: 4 * 60 * 60,
    inactivityTimeout: 30 * 60,
  });
  await sessionManager.start();

  // ── 1. Start the Browser SDK (provider-first) ────────────────────────────
  startBrowserSdk({
    serviceName: 'do11y-docusaurus-demo',
    serviceVersion: '1.0.0',
    logLevel: 'DEBUG',
    resourceAttributes: {
      'deployment.environment': 'test',
    },
    logs: {
      // Session processor first, then the batching OTLP exporter.
      processors: [createSessionLogRecordProcessor(sessionManager)],
      exportConfig: {
        url: `${OTLP_ENDPOINT}/v1/logs`,
      },
    },
    traces: {
      processors: [createSessionSpanProcessor(sessionManager)],
      exportConfig: {
        url: `${OTLP_ENDPOINT}/v1/traces`,
      },
    },
  });

  // ── 2. Register instrumentations (Do11y alongside the OTel ones) ─────────
  registerInstrumentations({
    instrumentations: [
      // The whole point: Do11y's docs observability on top of the OTel SDK.
      //
      // - trackSpaPathChanges: Docusaurus is an SPA — without this, page_exit
      //   and the next page_view are never emitted on navigation.
      // - sessionAttributes: false — the Browser SDK session processors above
      //   already attach `session.id`; emitting our own would duplicate it.
      new DocsInstrumentation({
        framework: 'docusaurus',
        trackSpaPathChanges: true,
        sessionAttributes: false,
        debug: true,
        respectDNT: false,
      }),
      // The browser's own instrumentation, so docs events are correlated with
      // performance and UX telemetry in the same pipeline.
      new WebVitalsInstrumentation({ includeRawAttribution: true }),
      new NavigationTimingInstrumentation(),
      new ResourceTimingInstrumentation(),
      new UserActionInstrumentation(),
    ],
  });

  console.info(
    '[do11y-otel] Do11y + OpenTelemetry Browser SDK initialized; exporting to',
    OTLP_ENDPOINT,
  );
}
