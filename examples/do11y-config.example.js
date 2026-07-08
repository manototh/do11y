/**
 * Do11y configuration example.
 *
 * Copy this file alongside do11y.js in your docs site and rename it to
 * do11y-config.js. Set the values below to match your setup.
 *
 * This file must load before do11y.js. For frameworks that auto-include
 * all .js files (like Mintlify), alphabetical ordering handles this
 * automatically.
 *
 * Any option from the config object in do11y.js can be set here.
 * See the README for the full list.
 *
 * All events use OpenTelemetry semantic convention attribute naming.
 */
window.Do11yConfig = {
  // Destination: 'supabase' (default), 'http', or 'otlp'
  destination: 'supabase',

  // ── Supabase (default) ─────────────────────────────────────────────────
  // Required for Supabase destination:
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseKey: 'sb_publishable_YOUR_KEY',

  // Optional: Table name (default: 'do11y_events').
  supabaseTable: 'do11y_events',

  // ── Generic HTTP ───────────────────────────────────────────────────────
  // destination: 'http',
  // endpoint: 'https://your-endpoint.com/events',
  // headers: { 'Authorization': 'Bearer your-token' },
  //
  // Optional: transform the event array before sending.
  // Default: sends [event, event, ...]
  // bodyTransform: (events) => events.map(e => ({ payload: e })),

  // ── OTLP (OpenTelemetry SDK) ──────────────────────────────────────────
  // destination: 'otlp',
  // otelSdkEndpoint: 'https://otlp.grafana.com/otlp',
  // otelSdkHeaders: { 'Authorization': 'Bearer your-token' },
  // otelSdkServiceName: 'my-docs',
  //
  // ⚠️ CORS: Cloud OTLP endpoints (Grafana, Datadoc, etc.) do not
  // return CORS headers, so browsers block direct cross-origin POSTs.
  // To use from a browser, run an OTel Collector or CORS proxy in front.
  // See https://docservable.com/configuration#otlp for details.

  // Documentation framework. Supported values:
  // 'mintlify', 'docusaurus', 'nextra', 'starlight', 'mkdocs-material',
  // 'vitepress', 'custom'
  framework: 'mintlify',

  // Optional: restrict which domains may send data.
  // Set to null to allow any domain.
  // allowedDomains: ['docs.example.com'],
};
