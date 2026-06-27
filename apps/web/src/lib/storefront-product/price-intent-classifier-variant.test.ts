import { describe, expect, it } from 'vitest';
import { classifyPriceIntentKeyword } from './price-intent-classifier';

describe('classifyPriceIntentKeyword variant and category hub regressions', () => {
  it('does not choose an arbitrary PDP for generic variant-family price queries', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone x price',
      catalog: [
        {
          slug: 'iphone-x-128gb',
          name: 'iPhone X 128GB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
          productKeySpecs: { storage_gb: 128 },
        },
        {
          slug: 'iphone-x-64gb',
          name: 'iPhone X 64GB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
          productKeySpecs: { storage_gb: 64 },
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'iphone-smartphones-price',
      matchedProductSlugs: ['iphone-x-128gb', 'iphone-x-64gb'],
    });
  });

  it('still chooses the exact PDP when the storage modifier disambiguates variants', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone x 64gb price',
      catalog: [
        {
          slug: 'iphone-x-128gb',
          name: 'iPhone X 128GB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
          productKeySpecs: { storage_gb: 128 },
        },
        {
          slug: 'iphone-x-64gb',
          name: 'iPhone X 64GB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
          productKeySpecs: { storage_gb: 64 },
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      modifiers: ['64gb'],
      targetSlug: 'iphone-x-64gb',
    });
  });

  it('uses the category slug for category-only hubs', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'laptop price',
      catalog: [
        {
          slug: 'macbook-air-m2',
          name: 'MacBook Air M2',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
        },
        {
          slug: 'thinkpad-x1-carbon',
          name: 'ThinkPad X1 Carbon',
          brand: 'Lenovo',
          categorySlug: 'laptops',
          condition: 'new',
        },
        {
          slug: 'asus-gaming-laptop',
          name: 'ASUS Gaming Laptop',
          brand: 'ASUS',
          categorySlug: 'laptops',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'laptops',
      hubSlug: 'laptops-price',
      matchedProductSlugs: [
        'macbook-air-m2',
        'thinkpad-x1-carbon',
        'asus-gaming-laptop',
      ],
    });
  });
});
