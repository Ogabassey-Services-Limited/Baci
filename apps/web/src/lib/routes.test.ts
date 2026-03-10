import { describe, expect, it } from 'vitest';
import { buildStorefrontPath } from './routes';

describe('buildStorefrontPath', () => {
  it('joins storefront path segments without double slashes', () => {
    expect(buildStorefrontPath('/test-store', 'products')).toBe(
      '/test-store/products'
    );
    expect(buildStorefrontPath('/', '/products')).toBe('/products');
  });

  it('encodes dynamic segments before building the href', () => {
    expect(buildStorefrontPath('/test store', 'javascript:alert(1)')).toBe(
      '/test%20store/javascript%3Aalert(1)'
    );
  });
});
