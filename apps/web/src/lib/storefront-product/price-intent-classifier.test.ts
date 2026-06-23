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
    productKeySpecs: { storage_gb: 128 },
  },
  {
    slug: 'iphone-x-64gb-uk-used',
    name: 'iPhone X 64GB UK Used',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'UK Used',
    productKeySpecs: { storage_gb: 64 },
  },
  {
    slug: 'iphone-xr-128gb-uk-used',
    name: 'iPhone XR 128GB UK Used',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'UK Used',
    productKeySpecs: { storage_gb: 128 },
  },
  {
    slug: 'redmi-10',
    name: 'Redmi 10',
    brand: 'Xiaomi',
    categorySlug: 'smartphones',
    condition: 'new',
    productKeySpecs: { storage_gb: 128 },
  },
  {
    slug: 'redmi-a5',
    name: 'Redmi A5',
    brand: 'Xiaomi',
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
  {
    slug: 'unused-iphone-8',
    name: 'iPhone 8',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'unused',
  },
];

function classify(keyword: string, options = {}) {
  return classifyPriceIntentKeyword({
    keyword,
    catalog,
    marketPhrase: 'Nigeria',
    ...options,
  });
}

describe('classifyPriceIntentKeyword', () => {
  it('maps exact product price queries to the matching PDP', () => {
    const keyword = 'redmi 10 price in nigeria';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'redmi-10',
      categorySlug: 'smartphones',
      modifiers: [],
    });
  });

  it('keeps variant and condition modifiers on the PDP when the catalog supports them', () => {
    const keyword = 'how much is iphone x 64gb in nigeria uk used';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-x-64gb-uk-used',
      categorySlug: 'smartphones',
      modifiers: ['64gb', 'uk-used'],
    });
  });

  it('routes broad brand price-list queries to a category price hub', () => {
    const keyword = 'samsung phone price in nigeria';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'samsung-smartphones-price-in-nigeria',
      matchedProductSlugs: ['samsung-galaxy-a07', 'samsung-galaxy-a14'],
    });
  });

  it('does not target unsupported UK-used modifiers to a new-product PDP', () => {
    const keyword = 'iphone 13 pro price in nigeria uk used';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'iphone-13-pro',
      modifiers: ['uk-used'],
    });
  });

  it('does not match the used modifier inside words like unused', () => {
    const keyword = 'iphone 8 price in nigeria used';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'unused-iphone-8',
      modifiers: ['used'],
    });
  });

  it('does not treat partial storage tokens as exact capacity matches', () => {
    const keyword = 'iphone xr 28gb price in nigeria';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'iphone-xr-128gb-uk-used',
      modifiers: ['28gb'],
    });
  });

  it('clamps invalid hub thresholds to one matching catalog product', () => {
    const keyword = 'samsung price in nigeria';

    const result = classify(keyword, {
      catalog: [catalog[5]],
      minHubProducts: 0,
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      matchedProductSlugs: ['samsung-galaxy-a07'],
    });
  });

  it('uses caller-provided market phrase for localized hub slugs', () => {
    const keyword = 'samsung phone price in nigeria';

    expect(classifyPriceIntentKeyword({ keyword, catalog })).toMatchObject({
      assetKind: 'price-hub',
      hubSlug: 'samsung-smartphones-price',
    });
    expect(classify(keyword)).toMatchObject({
      assetKind: 'price-hub',
      hubSlug: 'samsung-smartphones-price-in-nigeria',
    });
  });

  it('matches products with single-digit GB and TB specs as non-core tokens', () => {
    const keyword = 'macbook pro price';

    const result = classifyPriceIntentKeyword({
      keyword,
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
    const keyword = 'iphone 13 pro 128gb price';

    const result = classifyPriceIntentKeyword({
      keyword,
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
    const keyword = 'samsung a14 price';

    const result = classifyPriceIntentKeyword({
      keyword,
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
    const keyword = 'iphone 13 pro price';

    const result = classifyPriceIntentKeyword({
      keyword,
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
    const keyword = 'pro phone price';

    const result = classifyPriceIntentKeyword({
      keyword,
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
    const keyword = 'iphone 13 pro rate';

    expect(classify(keyword)).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-13-pro',
    });
  });

  it('reuses a prepared catalog without rebuilding product token data', () => {
    const keyword = 'samsung phone price in nigeria';
    const preparedCatalog = preparePriceIntentCatalog(catalog, 'Nigeria');

    const result = classifyPriceIntentKeyword({
      keyword,
      catalog: [],
      marketPhrase: 'Nigeria',
      preparedCatalog,
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      hubSlug: 'samsung-smartphones-price-in-nigeria',
    });
  });

  it('marks non-price keywords as ignored', () => {
    const keyword = 'iphone 13 pro review';

    const result = classify(keyword);

    expect(result).toMatchObject({
      assetKind: 'ignore',
      reason: 'not_price_intent',
    });
  });
});
