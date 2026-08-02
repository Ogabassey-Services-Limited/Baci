import { describe, expect, it } from 'vitest';
import { sanitizeForSafeHtml } from './sanitized-html';

describe('sanitizeForSafeHtml', () => {
  it('returns allowlisted markup as a branded safe-html value', () => {
    expect(sanitizeForSafeHtml('<p>Safe</p><script>alert(1)</script>')).toBe(
      '<p>Safe</p>'
    );
  });
});
