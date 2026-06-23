import { describe, expect, it } from 'vitest';
import { preparePriceIntentCatalog } from './price-intent-catalog';
import { classifyPriceIntentKeyword } from './price-intent-classifier';

const appleMixedCatalog = [
  {
    slug: 'iphone-13',
    name: 'iPhone 13',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'iphone-14',
    name: 'iPhone 14',
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
    slug: 'targus-apple-watch-strap',
    name: 'Apple Watch Strap',
    brand: 'Targus',
    categorySlug: 'accessories',
    condition: 'new',
  },
];

const redMagicCatalog = [
  {
    slug: 'red-magic-10-pro',
    name: 'Red Magic 10 Pro',
    brand: 'Red Magic',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'red-magic-9-pro',
    name: 'Red Magic 9 Pro',
    brand: 'Red Magic',
    categorySlug: 'smartphones',
    condition: 'new',
  },
  {
    slug: 'iphone-13-red',
    name: 'iPhone 13 Red',
    brand: 'Apple',
    categorySlug: 'smartphones',
    condition: 'new',
  },
];

describe('classifyPriceIntentKeyword follow-up regressions', () => {
  it('keeps brand-only hubs in one category and scoped to the brand', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'apple price in nigeria',
      marketPhrase: 'Nigeria',
      catalog: appleMixedCatalog,
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'apple-smartphones-price-in-nigeria',
      matchedProductSlugs: ['iphone-13', 'iphone-14'],
    });
  });

  it('matches brand-derived hubs against brand tokens, not arbitrary color tokens', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'red magic phone price',
      catalog: redMagicCatalog,
    });

    expect(result).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'red-smartphones-price',
      matchedProductSlugs: ['red-magic-10-pro', 'red-magic-9-pro'],
    });
  });

  it('treats category words as exact-match stop tokens', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'macbook pro laptop price',
      catalog: [
        {
          slug: 'macbook-pro',
          name: 'MacBook Pro',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'macbook-pro',
    });
  });

  it('does not require brand tokens for exact PDP matches', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'iphone 16 pro max price',
      catalog: [
        {
          slug: 'iphone-16-pro-max',
          name: 'Apple iPhone 16 Pro Max',
          brand: 'Apple',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-16-pro-max',
    });
  });

  it('requires explicitly requested optional network tokens', () => {
    const baseOnlyResult = classifyPriceIntentKeyword({
      keyword: 'samsung a14 5g price',
      catalog: [
        {
          slug: 'samsung-galaxy-a14',
          name: 'Samsung Galaxy A14',
          brand: 'Samsung',
          categorySlug: 'smartphones',
          condition: 'new',
        },
      ],
    });

    expect(baseOnlyResult).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'no_matching_catalog_entity',
    });

    const variantResult = classifyPriceIntentKeyword({
      keyword: 'samsung a14 5g price',
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

    expect(variantResult).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'samsung-galaxy-a14-5g',
    });
  });

  it('respects requested category when choosing exact PDP matches', () => {
    const wrongCategoryResult = classifyPriceIntentKeyword({
      keyword: 'macbook pro phone price',
      catalog: [
        {
          slug: 'macbook-pro',
          name: 'MacBook Pro',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
        },
      ],
    });

    expect(wrongCategoryResult).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'no_matching_catalog_entity',
    });
  });

  it('ignores storage and ram labels after extracting modifiers', () => {
    const result = classifyPriceIntentKeyword({
      keyword: 'macbook pro 16gb ram price',
      catalog: [
        {
          slug: 'macbook-pro-16gb',
          name: 'MacBook Pro',
          brand: 'Apple',
          categorySlug: 'laptops',
          condition: 'new',
          productKeySpecs: { ram_gb: 16 },
        },
      ],
    });

    expect(result).toMatchObject({
      assetKind: 'pdp',
      modifiers: ['16gb'],
      targetSlug: 'macbook-pro-16gb',
    });
  });

  it('does not classify electronics spec rate phrases as price intent', () => {
    for (const keyword of [
      'iphone 13 pro touch sampling rate',
      'iphone 13 pro frame rate',
      'iphone 13 pro refresh rates',
    ]) {
      expect(
        classifyPriceIntentKeyword({
          keyword,
          catalog: appleMixedCatalog,
          marketPhrase: 'Nigeria',
        })
      ).toMatchObject({
        assetKind: 'ignore',
        reason: 'not_price_intent',
      });
    }
  });

  it('prepares brand tokens as accepted tokens without making them required', () => {
    const preparedCatalog = preparePriceIntentCatalog([
      {
        slug: 'samsung-galaxy-a14',
        name: 'Samsung Galaxy A14',
        brand: 'Samsung',
        categorySlug: 'smartphones',
        condition: 'new',
      },
    ]);
    const [entry] = preparedCatalog.entries;

    expect(entry?.brandTokens).toEqual(['samsung']);
    expect(entry?.coreTokens).toEqual(['galaxy', 'a14']);
    expect(entry?.tokenSet.has('samsung')).toBe(true);
  });
});
