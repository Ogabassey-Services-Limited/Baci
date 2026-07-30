import { describe, expect, it } from 'vitest';
import { productQueryKeys } from './product-query-keys';

describe('productQueryKeys', () => {
  it('scopes product list and detail keys to the originating merchant', () => {
    expect(productQueryKeys.list('merchant-1')).toEqual([
      'products',
      'merchant-1',
    ]);
    expect(productQueryKeys.detail('merchant-1', 'product-1')).toEqual([
      'product',
      'merchant-1',
      'product-1',
    ]);
  });

  it('keeps unauthenticated product keys unscoped', () => {
    expect(productQueryKeys.list()).toEqual(['products']);
    expect(productQueryKeys.detail(undefined, 'product-1')).toEqual([
      'product',
    ]);
  });
});
