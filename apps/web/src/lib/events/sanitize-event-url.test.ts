import { describe, expect, it } from 'vitest';
import { sanitizeEventUrl } from './sanitize-event-url';

describe('sanitizeEventUrl', () => {
  it('removes query strings, fragments, and embedded credentials', () => {
    expect(
      sanitizeEventUrl(
        'https://user:password@example.com/product?token=private#details'
      )
    ).toBe('https://example.com/product');
  });

  it('removes query strings and fragments from relative URLs', () => {
    expect(sanitizeEventUrl('/pricing?email=person@example.com#signup')).toBe(
      '/pricing'
    );
  });

  it('removes embedded credentials from protocol-relative URLs', () => {
    expect(
      sanitizeEventUrl(
        '//user:password@example.com/product?token=private#details'
      )
    ).toBe('//example.com/product');
  });

  it('removes embedded credentials when absolute URL parsing fails', () => {
    expect(
      sanitizeEventUrl(
        'https://user:password@example.com:invalid/product?token=private#details'
      )
    ).toBe('https://example.com:invalid/product');
  });
});
