/**
 * Unit tests — DOM utility functions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDOM, teardownTestDOM } from '../../helpers/mock-dom';
import {
  extractCodeLanguage,
  resolveTocHash,
  getNearestHeading,
  sanitizeText,
} from '@do11y/core/dom-utils';

describe('dom-utils', () => {
  beforeEach(() => {
    setupTestDOM();
  });

  afterEach(() => {
    teardownTestDOM();
  });

  describe('extractCodeLanguage', () => {
    it('returns "unknown" for null input', () => {
      expect(extractCodeLanguage(null)).toBe('unknown');
    });

    it('reads language from a "language" attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('language', 'typescript');
      expect(extractCodeLanguage(el)).toBe('typescript');
    });

    it('reads language from data-language attribute', () => {
      const el = document.createElement('pre');
      el.setAttribute('data-language', 'python');
      expect(extractCodeLanguage(el)).toBe('python');
    });

    it('reads language from class "language-*"', () => {
      const el = document.createElement('code');
      el.className = 'language-javascript';
      expect(extractCodeLanguage(el)).toBe('javascript');
    });

    it('reads language from a parent element with language-* class', () => {
      const parent = document.createElement('div');
      parent.className = 'language-ruby';
      const child = document.createElement('code');
      parent.appendChild(child);
      expect(extractCodeLanguage(child)).toBe('ruby');
    });

    it('reads language from a sibling span.lang element', () => {
      const parent = document.createElement('div');
      const langSpan = document.createElement('span');
      langSpan.className = 'lang';
      langSpan.textContent = 'go';
      const button = document.createElement('button');
      parent.appendChild(langSpan);
      parent.appendChild(button);
      document.body.appendChild(parent);
      expect(extractCodeLanguage(button)).toBe('go');
    });

    it('returns "unknown" when no language indicator is found', () => {
      const el = document.createElement('div');
      el.textContent = 'just some text';
      expect(extractCodeLanguage(el)).toBe('unknown');
    });
  });

  describe('resolveTocHash', () => {
    it('returns the hash when href starts with #', () => {
      expect(resolveTocHash('#installation')).toBe('#installation');
    });

    it('returns the hash when href contains # and path matches current path', () => {
      // Current pathname is '/' from JSDOM setup
      expect(resolveTocHash('/#installation')).toBe('#installation');
    });

    it('returns null when there is no hash', () => {
      expect(resolveTocHash('/guide')).toBeNull();
    });

    it('returns null when href has a hash but points to a different path', () => {
      expect(resolveTocHash('/other-page#section')).toBeNull();
    });
  });

  describe('getNearestHeading', () => {
    it('returns null when there are no headings', () => {
      teardownTestDOM();
      setupTestDOM('<!DOCTYPE html><html><body><p>No headings here</p></body></html>');
      const el = document.querySelector('p')!;
      expect(getNearestHeading(el)).toBeNull();
    });

    it('finds the nearest preceding heading sibling', () => {
      const h2 = document.createElement('h2');
      h2.textContent = 'Installation';
      const p = document.createElement('p');
      p.textContent = 'Some text';
      document.body.appendChild(h2);
      document.body.appendChild(p);
      expect(getNearestHeading(p)).toBe('Installation');
    });

    it('finds the nearest heading from a parent element', () => {
      const h2 = document.createElement('h2');
      h2.textContent = 'Configuration';
      const div = document.createElement('div');
      const p = document.createElement('p');
      div.appendChild(p);
      document.body.appendChild(h2);
      document.body.appendChild(div);
      expect(getNearestHeading(p)).toBe('Configuration');
    });

    it('truncates to 100 characters', () => {
      const h2 = document.createElement('h2');
      h2.textContent = 'A'.repeat(200);
      const p = document.createElement('p');
      document.body.appendChild(h2);
      document.body.appendChild(p);
      const result = getNearestHeading(p);
      expect(result).toBe('A'.repeat(100));
    });
  });

  describe('sanitizeText', () => {
    it('returns null for null input', () => {
      expect(sanitizeText(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(sanitizeText(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(sanitizeText('')).toBeNull();
    });

    it('truncates to default max length of 100', () => {
      // Use 'x' (not hex char 'a') to avoid hex-secret redaction
      const result = sanitizeText('x'.repeat(200));
      expect(result).toBe('x'.repeat(100));
    });

    it('truncates to custom max length', () => {
      const result = sanitizeText('hello world', 5);
      expect(result).toBe('hello');
    });

    it('redacts email addresses', () => {
      const result = sanitizeText('Contact me at user@example.com for help');
      expect(result).toContain('[email]');
      expect(result).not.toContain('user@example.com');
    });

    it('redacts phone numbers', () => {
      const result = sanitizeText('Call 555-123-4567 for support');
      expect(result).toContain('[phone]');
      expect(result).not.toContain('555-123-4567');
    });

    it('returns the original text (with redactions) when under max length', () => {
      const result = sanitizeText('Hello world');
      expect(result).toBe('Hello world');
    });
  });
});
