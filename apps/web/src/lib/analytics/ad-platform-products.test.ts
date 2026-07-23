import { describe, expect, it } from 'vitest';
import { toAdPlatformProducts } from './ad-platform-products';

describe('toAdPlatformProducts', () => {
  it('returns no provider products when contents are absent', () => {
    const contents = undefined;

    const result = toAdPlatformProducts(contents);

    expect(result).toEqual([]);
  });

  it('falls back from an empty name and missing price', () => {
    const contents = [{ id: 'sku-1', name: '', quantity: 2 }];

    const result = toAdPlatformProducts(contents);

    expect(result).toEqual([
      { id: 'sku-1', name: 'sku-1', price: 0, quantity: 2 },
    ]);
  });

  it('fills provider-required product names and prices', () => {
    const contents = [{ id: 'sku-1', quantity: 2 }];

    const result = toAdPlatformProducts(contents);

    expect(result).toEqual([
      { id: 'sku-1', name: 'sku-1', price: 0, quantity: 2 },
    ]);
  });

  it('preserves supplied product names and prices', () => {
    const contents = [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 2 }];

    const result = toAdPlatformProducts(contents);

    expect(result).toEqual([
      { id: 'sku-1', name: 'Phone', price: 100, quantity: 2 },
    ]);
  });
});
