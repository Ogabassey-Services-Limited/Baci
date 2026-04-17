import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/products';
import { mergeLocalProducts } from './merge-local-products';

function createProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    description: `Description ${id}`,
    status: 'active',
    price: 100,
    manage_stock: true,
    stock: 5,
    image: '/image.png',
    imageLarge: '/image-large.png',
    imageHint: 'hint',
    brand: 'Brand',
    gtin: '1234567890123',
    mpn: 'MPN',
    ...overrides,
  };
}

describe('mergeLocalProducts', () => {
  it('preserves dirty local edits for products still present in the incoming results', () => {
    const incoming = [
      createProduct('1', { price: 100 }),
      createProduct('2', { price: 200 }),
    ];
    const current = [
      createProduct('1', { price: 150 }),
      createProduct('2', { price: 200 }),
    ];

    const merged = mergeLocalProducts({
      current,
      dirtyProductIds: new Set(['1']),
      incoming,
    });

    expect(merged).toEqual([
      createProduct('1', { price: 150 }),
      createProduct('2', { price: 200 }),
    ]);
  });

  it('does not append dirty products that are absent from the current page results', () => {
    const incoming = [createProduct('3'), createProduct('4')];
    const current = [
      createProduct('1', { price: 150 }),
      createProduct('2', { price: 200 }),
    ];

    const merged = mergeLocalProducts({
      current,
      dirtyProductIds: new Set(['1']),
      incoming,
    });

    expect(merged).toEqual(incoming);
  });
});
