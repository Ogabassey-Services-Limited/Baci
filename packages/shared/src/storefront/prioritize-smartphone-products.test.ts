import { describe, expect, it } from 'vitest';
import { prioritizeSmartphoneProducts } from './prioritize-smartphone-products';

describe('prioritizeSmartphoneProducts', () => {
  it('moves smartphone categories ahead of other categories while preserving relative order', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'tv-1', category: 'Smart TVs' },
      { id: 'phone-1', category: 'Smartphones' },
      { id: 'laptop-1', category: 'Laptops' },
      { id: 'phone-2', category: 'Mobile Phones' },
    ]);

    expect(sorted.map((product) => product.id)).toEqual([
      'phone-1',
      'phone-2',
      'tv-1',
      'laptop-1',
    ]);
  });

  it('does not treat headphone categories as smartphones', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'audio-1', category: 'Headphones' },
      { id: 'phone-1', category: 'Phones' },
    ]);

    expect(sorted.map((product) => product.id)).toEqual(['phone-1', 'audio-1']);
  });

  it('handles empty array', () => {
    expect(prioritizeSmartphoneProducts([])).toEqual([]);
  });

  it('preserves order when all products are smartphones', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'a', category: 'Smartphones' },
      { id: 'b', category: 'Mobile Phones' },
      { id: 'c', category: 'Phones' },
    ]);

    expect(sorted.map((product) => product.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles products with null or undefined categories', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'a', category: null },
      { id: 'b', category: 'Smartphones' },
      { id: 'c', category: undefined },
    ]);

    expect(sorted.map((product) => product.id)).toEqual(['b', 'a', 'c']);
  });

  it('uses relation-backed category names and slugs as phone priority candidates', () => {
    const sorted = prioritizeSmartphoneProducts([
      { id: 'case-1', category: 'Accessories' },
      {
        id: 'phone-1',
        category: null,
        categories: { name: 'Smartphones', slug: 'smartphones' },
      },
      {
        id: 'phone-2',
        category: undefined,
        categories: [{ name: 'Devices', slug: 'mobile-phones' }],
      },
    ]);

    expect(sorted.map((product) => product.id)).toEqual([
      'phone-1',
      'phone-2',
      'case-1',
    ]);
  });
});
