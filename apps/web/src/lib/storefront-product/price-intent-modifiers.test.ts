import { describe, expect, it } from 'vitest';
import { productSupportsPriceIntentModifiers } from './price-intent-modifiers';

const baseProduct = {
  slug: 'iphone-13-pro',
  name: 'iPhone 13 Pro',
  brand: 'Apple',
  categorySlug: 'smartphones',
  condition: 'new',
};

describe('productSupportsPriceIntentModifiers', () => {
  it('matches storage modifiers from numeric specs with explicit units', () => {
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, productKeySpecs: { storage_tb: 1 } },
        ['1tb']
      )
    ).toBe(true);
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, productKeySpecs: { storage_mb: 512 } },
        ['512mb']
      )
    ).toBe(true);
  });

  it('treats numeric storage or ram specs without key units as GB', () => {
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, productKeySpecs: { storage: 128 } },
        ['128gb']
      )
    ).toBe(true);
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, productKeySpecs: { ram: 8 } },
        ['8gb']
      )
    ).toBe(true);
  });

  it('rejects partial storage modifiers', () => {
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, productKeySpecs: { storage_gb: 128 } },
        ['28gb']
      )
    ).toBe(false);
  });

  it('requires used condition modifiers to match actual condition text', () => {
    expect(productSupportsPriceIntentModifiers(baseProduct, ['used'])).toBe(
      false
    );
    expect(
      productSupportsPriceIntentModifiers(
        { ...baseProduct, condition: 'UK Used' },
        ['uk-used']
      )
    ).toBe(true);
  });
});
