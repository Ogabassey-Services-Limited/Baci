import { describe, expect, it } from 'vitest';
import { sanitizeSearchQuery } from './sanitize-core';

describe('sanitizeSearchQuery', () => {
  it('should remove special characters that could be used for injection', () => {
    const input = '<script>alert("xss")</script>';
    // We allow forward slash as it's common in product names (e.g. "N/A")
    // Parentheses and quotes are removed
    expect(sanitizeSearchQuery(input)).toBe('scriptalertxss/script');
  });

  it('should remove quotes and backslashes', () => {
    const input = `'";\\`;
    expect(sanitizeSearchQuery(input)).toBe('');
  });

  it('should remove PostgREST control characters (comma, parens, pipe)', () => {
    // These characters can break Supabase/PostgREST filter syntax
    // e.g. .or(name.eq.foo,sku.eq.bar)
    const input = 'foo,bar(baz)|qux';
    expect(sanitizeSearchQuery(input)).toBe('foobarbazqux');
  });
});
