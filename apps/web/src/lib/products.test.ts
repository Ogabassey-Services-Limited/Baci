import { describe, expect, it } from 'vitest';
import { getSampleProductsForBusinessType } from '@/lib/products';

describe('getSampleProductsForBusinessType', () => {
  it('returns food sample products for food aliases', () => {
    const products = getSampleProductsForBusinessType('restaurant');

    expect(products.map((product) => product.name)).toContain(
      'Artisanal Sourdough Loaf'
    );
    expect(
      products.some((product) => product.description?.match(/sourdough/i))
    ).toBe(true);
  });

  it.each([
    'Restaurant',
    'RESTAURANT',
    'cafe',
    'bakery',
  ])('returns food samples for alias %s', (businessType) => {
    const products = getSampleProductsForBusinessType(businessType);

    expect(products.map((product) => product.name)).toContain(
      'Artisanal Sourdough Loaf'
    );
  });

  it('returns fashion sample products for direct categories', () => {
    const products = getSampleProductsForBusinessType('fashion');

    expect(products.map((product) => product.name)).toContain(
      'Linen Summer Dress'
    );
  });

  it('returns pharmacy sample products for pharmaceuticals', () => {
    const products = getSampleProductsForBusinessType('pharmaceuticals');

    expect(products.map((product) => product.name)).toContain(
      'Digital Blood Pressure Monitor'
    );
    expect(
      products.some((product) => product.description?.match(/monitoring/i))
    ).toBe(true);
  });

  it('falls back to generic samples for unknown business types', () => {
    const products = getSampleProductsForBusinessType('unknown');

    expect(products).toHaveLength(2);
    expect(products[0]?.name).toBe('Ceramic Mug Set');
  });

  it.each([
    null,
    undefined,
    '',
  ])('falls back to generic samples for empty value %s', (businessType) => {
    const products = getSampleProductsForBusinessType(businessType);

    expect(products).toHaveLength(2);
    expect(products[0]?.name).toBe('Ceramic Mug Set');
  });
});
