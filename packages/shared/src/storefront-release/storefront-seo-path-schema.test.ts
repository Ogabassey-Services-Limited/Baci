import { describe, expect, it } from 'vitest';
import { StorefrontSeoPathSchema } from './storefront-seo-path-schema';

describe('StorefrontSeoPathSchema', () => {
  it('accepts normalized local storefront paths', () => {
    expect(StorefrontSeoPathSchema.parse('/products/phone')).toBe(
      '/products/phone'
    );
    expect(StorefrontSeoPathSchema.parse('/')).toBe('/');
  });

  it('rejects external, query, fragment, backslash, and traversal paths', () => {
    for (const path of [
      '//attacker.example/page',
      '/products?draft=1',
      '/products#details',
      '/products\\phone',
      '/products/../admin',
      '/products/%2e%2e/admin',
      '/products/%2fadmin',
      '/products/phone case',
      '/products/phone\ncase',
      '/products/%20case',
      '/products/%0acase',
      '/products/%00case',
      '/%252e%252e/admin',
      '/foo%252fbar',
      '/%255cadmin',
      '/%61bout',
    ])
      expect(StorefrontSeoPathSchema.safeParse(path).success).toBe(false);
  });
});
