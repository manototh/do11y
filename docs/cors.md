---
title: CORS setup
description: How to set up a CORS proxy or OpenTelemetry Collector when using the OTLP destination with Do11y.
head:
  - - meta
    - property: og:title
      content: CORS setup — Do11y
  - - meta
    - property: og:description
      content: How to set up a CORS proxy or OpenTelemetry Collector when using the OTLP destination with Do11y.
---

# CORS setup

Cloud OTLP endpoints (Grafana, Datadog, Honeycomb, and most other backends) don't return CORS headers. Browsers enforce the same-origin policy, which means they block cross-origin POST requests directly to those endpoints.

Do11y sends events from your docs domain to your OTLP backend. Since the backend is on a different origin, you need an intermediary that adds the required CORS headers.

Choose one of the following approaches:

- **[OpenTelemetry Collector](#opentelemetry-collector):** Run a collector with a CORS-enabled HTTP receiver that forwards logs to your backend.
- **[Cloudflare Worker](#cloudflare-worker):** Deploy a lightweight serverless proxy that adds CORS headers and forwards requests.

Both approaches keep your authentication tokens server-side so they're never exposed to the browser.

## OpenTelemetry Collector

The [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) is the standard solution for production deployments. It runs as a standalone service on your infrastructure and accepts OTLP requests from your docs domain with CORS enabled.

### Collector configuration

Create an `otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - ALLOWED_DOCS_DOMAIN
          allowed_headers:
            - Content-Type
            - Authorization

exporters:
  otlphttp:
    endpoint: https://BACKEND_ENDPOINT/otlp
    headers:
      Authorization: "API_TOKEN"

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [otlphttp]
```

Replace `ALLOWED_DOCS_DOMAIN` with your actual docs domain (for example, `https://docs.example.com`). Use wildcards like `https://*.example.com` or add localhost for testing (`http://localhost:3000`).

Replace `BACKEND_ENDPOINT` and `API_TOKEN` with your backend's values. For example, fors Grafana Cloud:

```yaml
exporters:
  otlphttp:
    endpoint: https://otlp-gateway-prod-<region>.grafana.net/otlp
    headers:
      Authorization: "Basic <base64-encoded-credentials>"
```

### Run the collector

**Using Docker:**

```bash
docker run -p 4318:4318 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector-contrib
```

**Using Docker Compose:**

```yaml
version: "3"
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib
    ports:
      - "4318:4318"
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol/config.yaml
```

### Do11y configuration

Point `otelSdkEndpoint` at the collector instead of directly at your backend:

```js
window.Do11yConfig = {
  destination: 'otlp',
  otelSdkEndpoint: 'https://collector.example.com:4318',
  // No otelSdkHeaders needed here. Auth is handled by the collector.
};
```

## Cloudflare Worker

A Cloudflare Worker is a lightweight alternative when you don't want to run a dedicated collector. It proxies OTLP requests from the browser to your backend, adding CORS headers to every response and injecting authentication server-side.

### Worker script

Create `otel-proxy-worker.js`:

```javascript
const BACKEND_OTLP_ENDPOINT = 'https://BACKEND_ENDPOINT/otlp';

const origin = request.headers.get('Origin') || '';
const allowed = origin === 'ALLOWED_DOCS_DOMAIN' || false;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': allowed ? origin : 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const authHeader = env.BACKEND_AUTH_TOKEN;
    if (!authHeader) {
      return new Response('Auth not configured', { status: 500, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetUrl = `${BACKEND_OTLP_ENDPOINT}${url.pathname}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: request.body,
      });

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
```

Replace `ALLOWED_DOCS_DOMAIN` with your actual docs domain (for example, `https://docs.example.com`).

Replace `BACKEND_ENDPOINT` with your backend's values.

### Wrangler configuration

Create `wrangler.toml`:

```toml
name = "do11y-otel-proxy"
main = "otel-proxy-worker.js"
compatibility_date = "2025-07-01"
```

### Deployment

```bash
npm install -g wrangler
wrangler login
wrangler deploy // Select a subdomain for your worker
wrangler secret put BACKEND_AUTH_TOKEN
```

After deployment, you get a URL like `https://do11y-otel-proxy.SUBDOMAIN.workers.dev`.

### Do11y configuration

```js
window.Do11yConfig = {
  destination: 'otlp',
  otelSdkEndpoint: 'https://do11y-otel-proxy.<your-subdomain>.workers.dev',
  // No otelSdkHeaders needed. Auth is handled by the Worker.
};
```

## Framework-specific actions

Keep the Worker script (or collector config) outside your docs project's public directory so your docs framework doesn't serve it as a static file.

| Framework | Additional action |
|---|---|
| **Mintlify** | Place the Worker script in `_infra/` and add `_infra/` to a `.mintignore` file |
| **Docusaurus** | Place the Worker script outside `static/`. Docusaurus only serves files from `static/` and `build/`. |
| **Nextra / VitePress / Starlight** | Place the Worker script in the project root or `_infra/`. These frameworks only serve content from `pages/`, `public/`, or `src/` |
| **MkDocs Material** | Place the Worker script outside `docs/`. MkDocs only serves files from the `docs/` directory. |
| **Manual / static HTML** | Place the Worker script outside your web root or configure your server to deny access to it. |
