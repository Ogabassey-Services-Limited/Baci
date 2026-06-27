import { describe, expect, it } from 'vitest';
import { classifyPriceIntentKeyword } from './price-intent-classifier';

const smartphoneCatalog = [
  {
    slug: 'iphone-13-pro',
    name: 'iPhone 13 Pro',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'iphone-x-64gb-uk-used',
    name: 'iPhone X 64GB UK Used',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'UK Used',
  },
  {
    slug: 'iphone-xr-128gb-uk-used',
    name: 'iPhone XR 128GB UK Used',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'UK Used',
  },
  {
    slug: 'redmi-10',
    name: 'Redmi 10',
    brand: 'Xiaomi',
    categorySlug: 'smartphones',
    condition: 'new',
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

describe('classifyPriceIntentKeyword review regressions', () => {
  it('rejects missing higher variants before choosing a base PDP', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone 13 pro max price in nigeria',
      marketPhrase: 'Nigeria',
      catalog: [smartphoneCatalog[0]],
    });

    expect(result).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'no_matching_catalog_entity',
    });
  });

  it('filters broad hub matches to an explicitly requested category', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'apple phone price in nigeria',
      marketPhrase: 'Nigeria',
      catalog: [
        {
          slug: 'iphone-13',
          name: 'iPhone 13',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
        {
          slug: 'macbook-air-m2',
          name: 'MacBook Air M2',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
        },
        {
          slug: 'iphone-14',
          name: 'iPhone 14',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'apple-smartphones-price-in-nigeria',
      matchedProductSlugs: ['iphone-13', 'iphone-14'],
    });
  });

  it('treats category-only price keywords as category hub intents', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'phone price in nigeria',
      catalog: smartphoneCatalog,
      marketPhrase: 'Nigeria',
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'smartphones-price-in-nigeria',
      matchedProductSlugs: smartphoneCatalog.map(({ slug }) => slug),
    });
  });

  it('matches numeric TB and MB storage specs by explicit key unit', () => {
    expect(
      classifyPriceIntentKeyword({
        keyword: 'iphone 13 pro 1tb price',
        catalog: [
          {
            slug: 'iphone-13-pro-1tb',
            name: 'iPhone 13 Pro',
            brand: 'Apple',
            categorySlug: 'smartphones',
            condition: 'new',
            productKeySpecs: { storage_tb: 1 },
          },
        ],
      })
    ).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-13-pro-1tb',
      modifiers: ['1tb'],
    });

    expect(
      classifyPriceIntentKeyword({
        keyword: 'legacy device 512mb price',
        catalog: [
          {
            slug: 'legacy-device-512mb',
            name: 'Legacy Device',
            brand: 'Nokia',
            categorySlug: 'smartphones',
            condition: 'new',
            productKeySpecs: { storage_mb: 512 },
          },
        ],
      })
    ).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'legacy-device-512mb',
      modifiers: ['512mb'],
    });
  });

  it('treats numeric storage or ram specs without key units as GB', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone 13 pro 128gb price',
      catalog: [
        {
          slug: 'iphone-13-pro-128gb',
          name: 'iPhone 13 Pro',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
          productKeySpecs: { storage: 128 },
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-13-pro-128gb',
      modifiers: ['128gb'],
    });
  });

  it('does not treat refresh-rate spec queries as price intent', () => {
    expect(
      classifyPriceIntentKeyword({
        keyword: 'iphone 13 pro refresh rate',
        catalog: smartphoneCatalog,
        marketPhrase: 'Nigeria',
      })
    ).toMatchObject({
      assetKind: 'ignore',
      reason: 'not_price_intent',
    });
  });

  it('does not treat isolated dual as an optional exact token', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'tecno spark pro price',
      catalog: [
        {
          slug: 'tecno-spark-dual-pro',
          name: 'Tecno Spark Dual Pro',
          brand: 'Tecno',
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

  it('allows dual only as part of dual-sim optional wording', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'tecno spark pro price',
      catalog: [
        {
          slug: 'tecno-spark-pro-dual-sim',
          name: 'Tecno Spark Pro Dual SIM',
          brand: 'Tecno',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'tecno-spark-pro-dual-sim',
    });
  });
});
