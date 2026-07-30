/**
 * Do11y — Documentation Observability
 *
 * Session management (No Cookies).
 *
 * Session data is stored in sessionStorage. sessionStorage is readable
 * by any JavaScript running on the same origin, so it should never
 * contain secrets. The session record holds only an anonymous ID and
 * a path-visit sequence (no query parameters, no PII). It is cleared
 * automatically when the browser tab closes.
 */
import type { SessionData } from "./types.js";

function generateSessionId(): string {
  // Math.random() is not cryptographically secure and must not be used as
  // a fallback for session ID generation. Both crypto APIs below are
  // available in every browser that supports fetch (our minimum baseline).
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    arr[6] = (arr[6]! & 0x0f) | 0x40;
    arr[8] = (arr[8]! & 0x3f) | 0x80;
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }
  // crypto is unavailable — return a fixed sentinel so the event is still
  // recorded but is clearly not a real session ID, rather than using
  // a predictable Math.random()-based value.
  return "no-crypto-00-0000-0000-000000000000";
}

function isValidSessionData(value: unknown): value is SessionData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.startTime === "string" &&
    Array.isArray(v.pageSequence) &&
    typeof v.pageCount === "number"
  );
}

export function getSession(): SessionData {
  let session: SessionData | null = null;
  try {
    const stored = sessionStorage.getItem("do11y_session");
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isValidSessionData(parsed)) {
        session = parsed;
      }
    }
  } catch {
    // sessionStorage not available or parsing error
  }

  if (!session) {
    session = {
      id: generateSessionId(),
      startTime: new Date().toISOString(),
      pageSequence: [],
      pageCount: 0,
      referrerCategory: null,
      aiPlatform: null,
    };
    saveSession(session);
  }

  return session;
}

export function saveSession(session: SessionData): void {
  try {
    sessionStorage.setItem("do11y_session", JSON.stringify(session));
  } catch {
    // sessionStorage not available
  }
}

export function updatePageSequence(path: string): SessionData {
  const session = getSession();
  session.pageCount++;
  session.pageSequence.push({
    path,
    timestamp: new Date().toISOString(),
    index: session.pageCount,
  });
  if (session.pageSequence.length > 50) {
    session.pageSequence = session.pageSequence.slice(-50);
  }
  saveSession(session);
  return session;
}

export { generateSessionId };
