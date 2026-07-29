/**
 * Do11y — Test Helpers
 *
 * Lightweight static file server for serving fixture HTML pages to Puppeteer.
 *
 * Replaces file:// URLs with http:// so that relative navigation links
 * (e.g. <a href="docsy-guide.html">) resolve correctly, enabling real
 * link-click tracking during integration tests.
 *
 * Usage:
 *   const server = await createStaticServer('/path/to/fixtures');
 *   const url = server.url + '/mintlify-start.html';
 *   await page.goto(url);
 *   await server.close();
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

export interface StaticServer {
  /** The base URL (http://127.0.0.1:{port}) */
  url: string;
  /** The port the server is listening on */
  port: number;
  /** Stop the server */
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Create and start a local HTTP server that serves files from a directory.
 */
export function createStaticServer(directory: string): Promise<StaticServer> {
  const root = path.resolve(directory);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Map the request URL to a file path
      const reqPath = req.url === '/' ? '/index.html' : req.url!;
      const filePath = path.join(root, reqPath);

      // Prevent directory traversal
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
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

      const staticServer: StaticServer = {
        url: baseUrl,
        port,
        close: (): Promise<void> => {
          return new Promise((resolveClose) => {
            server.close(() => resolveClose());
          });
        },
      };

      resolve(staticServer);
    });

    server.on('error', reject);
  });
}
