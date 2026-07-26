import { describe, expect, it } from 'vitest';
import { categoryImageUrlSchema } from './category-image-url';

describe('categoryImageUrlSchema', () => {
  it.each([
    'https://cdn.example.com/a.png',
    'http://cdn.example.com/a.png',
    'https://cdn.example.com/a.png?v=2',
  ])('accepts %s', (url) => {
    expect(categoryImageUrlSchema.safeParse(url).success).toBe(true);
  });

  describe('bugfix: z.url() accepts dangerous schemes', () => {
    it.each([
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/html,<script>alert(1)</script>'],
      ['file', 'file:///etc/passwd'],
      ['vbscript', 'vbscript:msgbox(1)'],
    ])('rejects a %s: URL', (_label, url) => {
      // The value renders into <img src> on the public storefront, so an
      // authenticated merchant could otherwise store XSS.
      expect(categoryImageUrlSchema.safeParse(url).success).toBe(false);
    });
  });

  it('rejects a non-URL string', () => {
    expect(categoryImageUrlSchema.safeParse('not a url').success).toBe(false);
  });

  it('rejects a URL longer than 2048 characters', () => {
    const long = `https://cdn.example.com/${'a'.repeat(2100)}`;
    expect(categoryImageUrlSchema.safeParse(long).success).toBe(false);
  });
});
