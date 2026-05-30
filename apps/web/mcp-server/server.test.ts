import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('should correctly escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml('Hello & welcome')).toBe('Hello &amp; welcome');
    expect(escapeHtml("It's a sunny day")).toBe('It&#039;s a sunny day');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });
});
