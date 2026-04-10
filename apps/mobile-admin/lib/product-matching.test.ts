import { describe, expect, it } from 'vitest';
import {
  buildProductSuggestionTerms,
  normalizeComparableProductName,
  type ProductMatchCandidate,
  rankProductMatches,
} from '@/lib/product-matching';

const PRODUCTS: ProductMatchCandidate[] = [
  {
    id: 'prod-1',
    name: 'Red Velvet Cake',
    sku: 'CAKE-1',
    price: 12000,
    category: 'Cakes',
  },
  {
    id: 'prod-2',
    name: 'Red Velvet Cake Large',
    sku: 'CAKE-2',
    price: 18000,
    category: 'Cakes',
  },
  {
    id: 'prod-3',
    name: 'Chocolate Cake',
    sku: 'CAKE-3',
    price: 10000,
    category: 'Cakes',
  },
  {
    id: 'prod-4',
    name: 'iPhone 14 Pro Max',
    sku: 'IPHONE-14-PRO-MAX',
    price: 980000,
    category: 'Phones',
  },
];

describe('normalizeComparableProductName', () => {
  it('collapses punctuation and whitespace for exact matching', () => {
    expect(normalizeComparableProductName('  Red-Velvet   Cake!! ')).toBe(
      'red velvet cake'
    );
  });

  it('normalizes compact device model names for search parity', () => {
    expect(normalizeComparableProductName('iPhone14ProMax')).toBe(
      'iphone 14 pro max'
    );
  });
});

describe('buildProductSuggestionTerms', () => {
  it('returns a normalized full name plus broad token terms', () => {
    expect(buildProductSuggestionTerms('Red Velvet Cake')).toEqual([
      'red velvet cake',
      'red velvet',
      'red',
      'velvet',
      'cake',
    ]);
  });
});

describe('rankProductMatches', () => {
  it('puts exact normalized matches first', () => {
    const matches = rankProductMatches(' red velvet cake ', PRODUCTS);

    expect(matches[0]).toMatchObject({
      isExact: true,
      product: { id: 'prod-1' },
    });
  });

  it('surfaces close variants as similar matches', () => {
    const matches = rankProductMatches('Red Velvet', PRODUCTS);

    expect(matches.map((match) => match.product.id)).toContain('prod-2');
    expect(matches[0]?.score).toBeGreaterThanOrEqual(0.45);
  });

  it('excludes the current product when editing', () => {
    const matches = rankProductMatches('Red Velvet Cake', PRODUCTS, {
      excludeProductId: 'prod-1',
    });

    expect(matches.some((match) => match.product.id === 'prod-1')).toBe(false);
  });

  it('matches compact promax queries against spaced product names', () => {
    const matches = rankProductMatches('iphone 14 promax', PRODUCTS);

    expect(matches[0]).toMatchObject({
      product: { id: 'prod-4' },
    });
  });
});
