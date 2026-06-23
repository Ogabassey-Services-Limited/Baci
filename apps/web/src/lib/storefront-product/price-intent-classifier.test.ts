import { describe, expect, it } from 'vitest';
import { classifyPriceIntentKeyword } from './price-intent-classifier';

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
    expect(classify('redmi 10 price in nigeria')).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'redmi-10',
      categorySlug: 'smartphones',
      modifiers: [],
    });
  });

  it('keeps variant and condition modifiers on supported PDPs', () => {
    expect(
      classify('how much is iphone x 64gb in nigeria uk used')
    ).toMatchObject({
      assetKind: 'pdp',
      targetSlug: 'iphone-x-64gb-uk-used',
      categorySlug: 'smartphones',
      modifiers: ['64gb', 'uk-used'],
    });
  });

  it('routes broad brand price-list queries to a category price hub', () => {
    expect(classify('samsung phone price in nigeria')).toMatchObject({
      assetKind: 'price-hub',
      categorySlug: 'smartphones',
      hubSlug: 'samsung-smartphones-price-in-nigeria',
      matchedProductSlugs: ['samsung-galaxy-a07', 'samsung-galaxy-a14'],
    });
  });

  it('does not target unsupported UK-used modifiers to a new-product PDP', () => {
    expect(classify('iphone 13 pro price in nigeria uk used')).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'iphone-13-pro',
      modifiers: ['uk-used'],
    });
  });

  it('does not match the used modifier inside words like unused', () => {
    expect(classify('iphone 8 price in nigeria used')).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'unused-iphone-8',
      modifiers: ['used'],
    });
  });

  it('does not treat partial storage tokens as exact capacity matches', () => {
    expect(classify('iphone xr 28gb price in nigeria')).toMatchObject({
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: 'iphone-xr-128gb-uk-used',
      modifiers: ['28gb'],
    });
  });

  it('clamps invalid hub thresholds to one matching catalog product', () => {
    expect(
      classify('samsung price in nigeria', {
        catalog: [catalog[4]],
        minHubProducts: 0,
      })
    ).toMatchObject({
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

  it('marks non-price keywords as ignored', () => {
    expect(classify('iphone 13 pro review')).toMatchObject({
      assetKind: 'ignore',
      reason: 'not_price_intent',
    });
  });
});
