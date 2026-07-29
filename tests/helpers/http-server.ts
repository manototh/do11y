/**
 * Do11y — Test Helpers
 *
 * Lightweight local HTTP server for testing export destinations.
 *
 * Provides:
 *   - createTestServer(): starts a local HTTP server on a random port,
 *     collects POST requests, returns control helpers.
 *   - The server accepts any POST/PUT/GET path and records the request.
 *
 * Usage:
 *   const server = await createTestServer();
 *   // use server.url as the endpoint
 *   const events = server.getReceived();
 *   await server.close();
 */

import http from 'http';

export interface ReceivedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
  timestamp: number;
}

export interface TestServer {
  /** The base URL (http://localhost:{port}) */
  url: string;
  /** The port the server is listening on */
  port: number;
  /** Get all received requests since server started or last clear */
  getReceived: () => ReceivedRequest[];
  /** Get requests matching a path pattern */
  getReceivedByPath: (pattern: string | RegExp) => ReceivedRequest[];
  /** Clear the received request log */
  clear: () => void;
  /** Get count of received requests */
  count: () => number;
  /** Wait until a condition on received requests is met (timeoutMs) */
  waitFor: (predicate: (reqs: ReceivedRequest[]) => boolean, timeoutMs?: number) => Promise<ReceivedRequest[]>;
  /** Stop the server */
  close: () => Promise<void>;
}

/**
 * Create and start a local HTTP test server.
 */
export function createTestServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const received: ReceivedRequest[] = [];

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let body: unknown = rawBody;
        try {
          body = JSON.parse(rawBody);
        } catch {
          // keep as raw string
        }

        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value)) {
            headers[key] = value.join(', ');
          }
        }

        received.push({
          method: req.method ?? 'GET',
          path: req.url ?? '/',
          headers,
          body,
          rawBody,
          timestamp: Date.now(),
        });

        // Add CORS headers so cross-origin requests from file:// pages work
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Respond with a simple success
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addr.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      const testServer: TestServer = {
        url: baseUrl,
        port,
        getReceived: () => [...received],
        getReceivedByPath: (pattern: string | RegExp) => {
          const regex = typeof pattern === 'string'
            ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            : pattern;
          return received.filter(r => regex.test(r.path));
        },
        clear: () => { received.length = 0; },
        count: () => received.length,
        waitFor: (predicate: (reqs: ReceivedRequest[]) => boolean, timeoutMs = 5000): Promise<ReceivedRequest[]> => {
          const start = Date.now();
          return new Promise((resolveWait, rejectWait) => {
            function check(): void {
              if (predicate(received)) {
                resolveWait([...received]);
              } else if (Date.now() - start > timeoutMs) {
                rejectWait(new Error('waitFor timed out'));
              } else {
                setTimeout(check, 20);
              }
            }
            check();
          });
        },
        close: (): Promise<void> => {
          return new Promise((resolveClose) => {
            server.close(() => resolveClose());
          });
        },
      };

      resolve(testServer);
    });

    server.on('error', reject);
  });
}
