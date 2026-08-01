import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers', () => {
  it('removes brand and category words while retaining model markers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Itel'],
      productSlugs: ['itel-power-80-128gb-4gb', 'itel-a06'],
    });

    expect(identifiers).toEqual(['80', 'a06']);
  });

  it('deduplicates identifiers across product variants', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: [
        'samsung-galaxy-s25-128gb',
        'samsung-galaxy-s25-256gb',
        'samsung-galaxy-s24',
      ],
    });

    expect(identifiers).toEqual(['s25', 's24']);
  });

  it('removes configured brand aliases from nonnumeric model slugs', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-z-trifold'],
    });

    expect(identifiers).toEqual(['trifold']);
  });

  it('prefers a model code over dimensions, years, and capacities', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['macbook-air-13-inch-2022-m2-8gb-256gb'],
    });

    expect(identifiers).toEqual(['m2']);
  });

  it('retains a later numeric model code after a screen-size token', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-xps-13-9350'],
    });

    expect(identifiers).toEqual(['9350']);
  });

  it('preserves a single-character model identifier', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'xbox',
      brands: ['Xbox'],
      productSlugs: ['xbox-series-x'],
    });

    expect(identifiers).toEqual(['x']);
  });
});
