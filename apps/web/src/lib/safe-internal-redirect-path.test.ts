import { describe, expect, it } from 'vitest';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';

describe('toSafeInternalRedirectPath', () => {
  it('returns trimmed internal paths', () => {
    expect(toSafeInternalRedirectPath(' /smartphones/iphone-15 ')).toBe(
      '/smartphones/iphone-15'
    );
  });

  it('returns basic valid internal paths unchanged', () => {
    expect(toSafeInternalRedirectPath('/products/item')).toBe('/products/item');
  });

  it('preserves valid query strings on internal paths', () => {
    expect(toSafeInternalRedirectPath('/products?sort=price')).toBe(
      '/products?sort=price'
    );
  });

  it('allows dots inside ordinary slug segments', () => {
    expect(toSafeInternalRedirectPath('/products/iphone-15.pro')).toBe(
      '/products/iphone-15.pro'
    );
  });

  it.each([
    null,
    undefined,
    123,
    '',
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example',
    '/%5c%5cevil.example',
    '/smartphones/iphone:15',
    '/%2f%2fevil.example/path',
    '/smartphones/iphone%3a15',
    '/products/..',
    '/products/.',
    '/products/%2e%2e',
    '/products/%2E',
    '/products/%2e%2e/details',
    '/products%3Fsort=price/..',
  ])('rejects unsafe redirect path %s', (value) => {
    expect(toSafeInternalRedirectPath(value)).toBeNull();
  });
});
