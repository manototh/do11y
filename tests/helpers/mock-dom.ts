/**
 * Do11y — Test Helpers
 *
 * DOM mocking utilities using JSDOM.
 *
 * Provides:
 *   - setupTestDOM(html): creates a JSDOM instance with all globals do11y
 *     depends on (IntersectionObserver, requestAnimationFrame, sessionStorage,
 *     location, navigator, CSS.escape).
 *   - teardownTestDOM(): restores the previous environment.
 *   - mockEvent(type, target, opts): dispatches a DOM event with given options.
 *   - Framework fixture builders: returns HTML strings mimicking each framework's DOM.
 */

import { JSDOM } from 'jsdom';

// ─── Globals that need JSDOM-compatible mocks ──────────────────────────────

function noop(): void { /* noop */ }

function createMockIntersectionObserver(): typeof IntersectionObserver {
  return class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '0px';
    readonly thresholds: ReadonlyArray<number> = [0];

    private callback: IntersectionObserverCallback;
    private elements: Set<Element> = new Set();

    constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      this.callback = callback;
    }

    observe(target: Element): void {
      this.elements.add(target);
      // Immediately fire with isIntersecting: true so tests can assert synchronously
      this.callback(
        [{ target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: {} as DOMRectReadOnly, intersectionRect: {} as DOMRectReadOnly, rootBounds: null, time: Date.now() }],
        this,
      );
    }

    unobserve(target: Element): void {
      this.elements.delete(target);
    }

    disconnect(): void {
      this.elements.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

function createMockCSS(): { escape: (s: string) => string } {
  return {
    // Real CSS.escape implementation to avoid infinite recursion from mocking
    escape: (s: string): string => {
      if (typeof s !== 'string') return '';
      return s.replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '\\$&');
    },
  };
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────

let activeDOM: JSDOM | null = null;

// Track properties we overrode via Object.defineProperty for restore
const overriddenProperties: Array<{ target: unknown; key: PropertyKey; descriptor: PropertyDescriptor | undefined }> = [];

/**
 * Safely define a property on globalThis (or any object), storing the original
 * descriptor so teardown can restore it.
 */
function overrideGlobal<T extends object>(
  obj: T,
  key: keyof T,
  value: unknown,
): void {
  const existingDescriptor = Object.getOwnPropertyDescriptor(obj, key);
  overriddenProperties.push({ target: obj, key, descriptor: existingDescriptor });
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: existingDescriptor?.enumerable ?? true,
  });
}

/**
 * Set up a JSDOM environment with all globals do11y needs.
 * Returns a cleanup function that restores the previous globals.
 */
export function setupTestDOM(html: string = createBasicDocPage()): () => void {
  const dom = new JSDOM(html, {
    url: 'http://localhost:4001/',
    pretendToBeVisual: true,
    storageQuota: 5_000_000,
  });
  activeDOM = dom;

  const win = dom.window as unknown as Record<string, unknown>;
  const doc = win.document as unknown as Document;

  // Override globals using defineProperty for safety with read-only props
  overrideGlobal(globalThis, 'window', win);
  overrideGlobal(globalThis as unknown as Record<string, unknown>, 'document', doc);
  (globalThis as unknown as Record<string, unknown>).IntersectionObserver = createMockIntersectionObserver();
  (globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback): number => {
    cb(performance.now());
    return 0;
  };
  (globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = noop;
  (globalThis as unknown as Record<string, unknown>).sessionStorage = (win as any).sessionStorage;
  (globalThis as unknown as Record<string, unknown>).localStorage = (win as any).localStorage;
  (globalThis as unknown as Record<string, unknown>).CSS = createMockCSS();

  // Replace location href and other location properties via defineProperty on globalThis
  overrideGlobal(globalThis as unknown as Record<string, unknown>, 'location', (win as any).location);
  overrideGlobal(globalThis as unknown as Record<string, unknown>, 'navigator', (win as any).navigator);

  // Expose JSDOM's DOM event constructors so helper functions like clickElement
  // work correctly. Without this, the global MouseEvent/KeyboardEvent may be
  // the Node.js scope's undefined values.
  (globalThis as unknown as Record<string, unknown>).Event = (win as any).Event;
  (globalThis as unknown as Record<string, unknown>).MouseEvent = (win as any).MouseEvent;
  (globalThis as unknown as Record<string, unknown>).KeyboardEvent = (win as any).KeyboardEvent;
  (globalThis as unknown as Record<string, unknown>).CustomEvent = (win as any).CustomEvent;

  return () => {
    teardownTestDOM();
  };
}

/**
 * Restore globals that were replaced by setupTestDOM.
 */
export function teardownTestDOM(): void {
  if (activeDOM) {
    activeDOM.window.close();
    activeDOM = null;
  }

  // Restore overridden properties in reverse order
  for (let i = overriddenProperties.length - 1; i >= 0; i--) {
    const { target, key, descriptor } = overriddenProperties[i]!;
    if (descriptor) {
      Object.defineProperty(target as any, key, descriptor);
    }
  }
  overriddenProperties.length = 0;
}

// ─── DOM Event Helpers ─────────────────────────────────────────────────────

export interface MockEventOptions {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
  button?: number;
  which?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  key?: string;
}

/**
 * Dispatch a click event on an element.
 */
export function clickElement(el: Element, opts: MockEventOptions = {}): void {
  const event = new MouseEvent('click', {
    bubbles: opts.bubbles ?? true,
    cancelable: opts.cancelable ?? true,
    composed: opts.composed ?? true,
    button: opts.button ?? 0,
    which: opts.which ?? 1,
    shiftKey: opts.shiftKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    altKey: opts.altKey ?? false,
  });
  el.dispatchEvent(event);
}

/**
 * Dispatch a keydown/keyup event sequence for a keyboard interaction.
 */
export function pressKey(key: string, target: Element = document.body, modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}): void {
  const downEvent = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
  });
  target.dispatchEvent(downEvent);

  const upEvent = new KeyboardEvent('keyup', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(upEvent);
}

/**
 * Dispatch a beforeunload event on the window.
 */
export function triggerBeforeUnload(): void {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
}

/**
 * Dispatch a visibilitychange event on the document.
 */
export function triggerVisibilityChange(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true });
  const event = new Event('visibilitychange');
  document.dispatchEvent(event);
}

/**
 * Set up a basic DOM structure mimicking a documentation page.
 * Used by unit tests that need a realistic environment.
 */
export function createBasicDocPage(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Test Documentation</title></head>
<body>
  <nav id="navbar">
    <a href="/guide">Guide</a>
    <a href="/api">API</a>
  </nav>
  <main>
    <h1>Getting Started</h1>
    <h2>Installation</h2>
    <p>Install via npm:</p>
    <pre><code class="language-bash">npm install do11y</code></pre>
    <button class="copy-button" aria-label="Copy code">Copy</button>
    <h2>Configuration</h2>
    <p>Configure your project.</p>
    <details>
      <summary>Advanced options</summary>
      <p>Hidden content here.</p>
    </details>
    <div class="toc">
      <a href="#installation">Installation</a>
      <a href="#configuration">Configuration</a>
    </div>
  </main>
  <footer>
    <p>Copyright</p>
    <a href="https://example.com/privacy">Privacy</a>
  </footer>
  <div id="search">
    <input class="search-input" placeholder="Search docs...">
    <button class="search-button">Search</button>
  </div>
</body>
</html>`;
}

/**
 * Get the currently active JSDOM instance, if any.
 */
export function getActiveDOM(): JSDOM | null {
  return activeDOM;
}
