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
});
