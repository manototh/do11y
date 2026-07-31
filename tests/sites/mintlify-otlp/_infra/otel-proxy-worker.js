/**
 * Do11y OTLP CORS Proxy — Cloudflare Worker
 *
 * Proxies OTLP/HTTP JSON requests from the browser (Mintlify docs site)
 * to Grafana Cloud's OTLP endpoint with proper CORS headers.
 *
 * Grafana Cloud (and most cloud OTLP backends) don't return CORS headers,
 * which blocks browser cross-origin POSTs. This Worker adds the required
 * headers and injects the Grafana auth token server-side.
 *
 * Deploy:
 *   1. wrangler deploy
 *   2. wrangler secret put GRAFANA_AUTH_TOKEN
 *      (paste the full Authorization header value, e.g.
 *       "Basic MTcxNTQ1ODpnbGNfZXlK...")
 *
 * Environment variables (set via wrangler secret):
 *   GRAFANA_AUTH_TOKEN  — The Authorization header value to forward to Grafana
 */

const GRAFANA_OTLP_ENDPOINT = 'https://otlp-gateway-prod-eu-central-0.grafana.net/otlp';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    // ── CORS preflight ──────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // ── Only POST is supported ──────────────────────────────────────────
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    // ── Check auth is configured ───────────────────────────────────────
    const authHeader = env.GRAFANA_AUTH_TOKEN;
    if (!authHeader) {
      return new Response(
        'Grafana auth not configured. Set the GRAFANA_AUTH_TOKEN secret via wrangler secret put.',
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // ── Forward to Grafana ─────────────────────────────────────────────
    const url = new URL(request.url);
    const targetUrl = `${GRAFANA_OTLP_ENDPOINT}${url.pathname}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: request.body,
      });

      // Attach CORS headers to the response
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
  },
};
