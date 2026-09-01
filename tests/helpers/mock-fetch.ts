/**
 * Do11y — Test Helpers
 *
 * fetch interceptor for transport tests.
 *
 * Provides:
 *   - mockFetch(): replaces globalThis.fetch with a controllable mock.
 *   - restoreFetch(): restores the original fetch.
 *   - getRequests(): returns array of intercepted fetch requests.
 *   - clearRequests(): clears the captured request log.
 *   - setMockResponse(status, body): configures the next response.
 *
 * Usage:
 *   import { mockFetch, restoreFetch, getRequests, setMockResponse } from '../helpers/mock-fetch';
 *
 *   beforeEach(() => { mockFetch(); });
 *   afterEach(() => { restoreFetch(); });
 *
 *   setMockResponse(200, { ok: true });
 *   await someFunctionThatFetches();
 *   const reqs = getRequests();
 *   expect(reqs[0].url).toBe('...');
 *   expect(reqs[0].body).toEqual(...);
 */

interface MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

interface MockResponseConfig {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  delay?: number;
  error?: boolean;
  errorMessage?: string;
}

let originalFetch: typeof globalThis.fetch | null = null;
let capturedRequests: MockRequest[] = [];
let responseQueue: MockResponseConfig[] = [];
let defaultResponse: MockResponseConfig = { status: 200, body: {} };

/**
 * Replace globalThis.fetch with a mock that records requests.
 */
export function mockFetch(): void {
  if (originalFetch) return; // already mocked
  originalFetch = globalThis.fetch;
  capturedRequests = [];
  responseQueue = [];

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input.url;
    const method = init?.method ?? 'GET';
    const headers = (init?.headers as Record<string, string>) ?? {};
    let body: unknown = undefined;
    if (init?.body) {
      try { body = JSON.parse(init.body as string); }
      catch { body = init.body; }
    }

    const request: MockRequest = { url, method, headers, body, timestamp: Date.now() };
    capturedRequests.push(request);

    // Pick from queue or use default
    const config = responseQueue.shift() ?? defaultResponse;

    if (config.error) {
      throw new Error(config.errorMessage ?? 'Mock fetch error');
    }

    if (config.delay) {
      await new Promise(r => setTimeout(r, config.delay));
    }

    const responseBody = config.body !== undefined ? JSON.stringify(config.body) : '';
    const responseHeaders = new Headers(config.headers ?? { 'Content-Type': 'application/json' });

    return new Response(responseBody, {
      status: config.status,
      statusText: config.status === 200 ? 'OK' : 'Error',
      headers: responseHeaders,
    });
  };
}

/**
 * Restore the original fetch implementation.
 */
export function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  capturedRequests = [];
  responseQueue = [];
}

/**
 * Get all captured fetch requests since the last mockFetch() call or clearRequests().
 */
export function getRequests(): MockRequest[] {
  return [...capturedRequests];
}

/**
 * Get requests filtered by URL pattern.
 */
export function getRequestsByUrl(pattern: string | RegExp): MockRequest[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : pattern;
  return capturedRequests.filter(r => regex.test(r.url));
}

/**
 * Clear the captured request log.
 */
export function clearRequests(): void {
  capturedRequests = [];
}

/**
 * Set the default response for all subsequent fetch calls.
 */
export function setDefaultResponse(status: number, body: unknown, headers?: Record<string, string>): void {
  defaultResponse = { status, body, headers };
}

/**
 * Queue a specific response for the next N fetch calls.
 * Responses are consumed in FIFO order.
 */
export function setMockResponse(status: number, body: unknown, headers?: Record<string, string>): void {
  responseQueue.push({ status, body, headers });
}

/**
 * Queue a network error to be thrown by the next fetch call.
 */
export function setMockError(message: string): void {
  responseQueue.push({ status: 0, body: null, error: true, errorMessage: message });
}

/**
 * Get the count of captured requests.
 */
export function getRequestCount(): number {
  return capturedRequests.length;
}

/**
 * Wait for a condition on captured requests (useful for async flush scenarios).
 */
export async function waitForRequests(
  predicate: (reqs: MockRequest[]) => boolean,
  timeoutMs: number = 5000,
): Promise<MockRequest[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate(capturedRequests)) return getRequests();
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('waitForRequests timed out');
}
