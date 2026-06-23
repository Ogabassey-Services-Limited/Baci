import { describe, expect, it } from 'vitest';
import {
  classifyPriceIntentKeyword,
  preparePriceIntentCatalog,
} from './price-intent-classifier';

const catalog = [
  {
    slug: 'iphone-13-pro',
    name: 'iPhone 13 Pro',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'samsung-galaxy-a07',
    name: 'Samsung Galaxy A07',
    brand: 'Samsung',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'samsung-galaxy-a14',
    name: 'Samsung Galaxy A14',
    brand: 'Samsung',
    categorySlug: 'smartphones',
    condition: 'new',
  },
];

describe('classifyPriceIntentKeyword edge cases', () => {
  it('matches products with single-digit GB and TB specs as non-core tokens', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'macbook pro price',
      catalog: [
        {
          slug: 'macbook-pro-8gb',
          name: 'MacBook Pro 8GB',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
        },
        {
          slug: 'iphone-13-pro-1tb',
          name: 'iPhone 13 Pro 1TB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'macbook-pro-8gb',
    });
  });

  it('normalizes spaced storage specs before matching modifiers', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone 13 pro 128gb price',
      catalog: [
        {
          slug: 'iphone-13-pro-128gb',
          name: 'iPhone 13 Pro 128 GB',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      modifiers: ['128gb'],
      targetSlug: 'iphone-13-pro-128gb',
    });
  });

  it('allows common non-essential model tokens to be omitted from exact queries', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'samsung a14 price',
      catalog: [
        {
          slug: 'samsung-galaxy-a14-5g',
          name: 'Samsung Galaxy A14 5G',
          brand: 'Samsung',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'samsung-galaxy-a14-5g',
    });
  });

  it('does not exact-match products when essential variant tokens are omitted', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone 13 pro price',
      catalog: [
        {
          slug: 'iphone-13-pro-max',
          name: 'iPhone 13 Pro Max',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'no_matching_catalog_entity',
    });
  });

  it('does not create broad hubs from generic model modifiers', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'pro phone price',
      catalog: [
        {
          slug: 'iphone-13-pro',
          name: 'iPhone 13 Pro',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
        {
          slug: 'redmi-note-14-pro',
          name: 'Redmi Note 14 Pro',
          brand: 'Xiaomi',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'no_matching_catalog_entity',
    });
  });

  it('accepts local rate queries as price intent', () => {
    expect(
      classifyPriceIntentKeyword({
        keyword: 'iphone 13 pro rate',
        catalog,
        marketPhrase: 'Nigeria',
      })
    ).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-13-pro',
    });
  });

  it('reuses a prepared catalog without rebuilding product token data', () => {
    const keyword = 'samsung phone price in nigeria';
    const preparedCatalog = preparePriceIntentCatalog(catalog, 'Nigeria');

    const result = classifyPriceIntentKeyword({
      keyword,
      marketPhrase: 'Nigeria',
      preparedCatalog,
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      hubSlug: 'samsung-smartphones-price-in-nigeria',
    });
  });
});
