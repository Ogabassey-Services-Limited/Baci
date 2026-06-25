import { describe, expect, it } from 'vitest';
import {
  getSeoProductName,
  normalizeSeoProductText,
} from './storefront-product-slug-disambiguation';

describe('getSeoProductName', () => {
  it('adds trailing slug storage tokens to distinguish variant PDP titles', () => {
    expect(
      getSeoProductName({
        name: 'Samsung Galaxy Tab S10 FE 5G',
        slug: 'samsung-galaxy-tab-s10-fe-5g-8gb-128gb',
      })
    ).toBe('Samsung Galaxy Tab S10 FE 5G 8GB 128GB');
  });

  it('adds trailing slug model tokens to distinguish laptop PDP titles', () => {
    expect(
      getSeoProductName({
        name: 'HP OmniBook Ultra Flip 14',
        slug: 'hp-omnibook-ultra-flip-14-fh0019nia',
      })
    ).toBe('HP OmniBook Ultra Flip 14 FH0019NIA');
  });

  it('does not append non-trailing slug tokens already represented in the name', () => {
    expect(
      getSeoProductName({
        name: 'PSN Gift Card £50',
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('PSN Gift Card £50 GBP');
  });

  it('normalizes plus signs so plus-model PDP titles stay unique', () => {
    expect(
      getSeoProductName({
        name: 'Samsung Galaxy Tab S9+',
        slug: 'samsung-galaxy-tab-s9-plus',
      })
    ).toBe('Samsung Galaxy Tab S9 Plus');
  });

  it('separates compact plus model tokens before matching slug tokens', () => {
    expect(
      getSeoProductName({
        name: 'Samsung Galaxy S10+5G',
        slug: 'samsung-galaxy-s10-plus-5g',
      })
    ).toBe('Samsung Galaxy S10 Plus 5G');
  });

  it('preserves separator plus signs in product names', () => {
    expect(
      getSeoProductName({
        name: 'USB-C + Lightning Cable',
        slug: 'usb-c-plus-lightning-cable',
      })
    ).toBe('USB-C + Lightning Cable');
    expect(
      getSeoProductName({
        name: '3 bundles + closure',
        slug: '3-bundles-plus-closure',
      })
    ).toBe('3 bundles + closure');
  });

  it('does not append leading slug-only brand tokens', () => {
    expect(
      getSeoProductName({
        name: 'iPhone 13',
        slug: 'apple-iphone-13',
      })
    ).toBe('iPhone 13');
  });

  it('matches compact model names before appending trailing variant tokens', () => {
    expect(
      getSeoProductName({
        name: 'iPhone15',
        slug: 'iphone-15-128gb',
      })
    ).toBe('iPhone15 128GB');
    expect(
      getSeoProductName({
        name: 'iPhone15',
        slug: 'iphone-15-256gb',
      })
    ).toBe('iPhone15 256GB');
  });

  it('does not append slug-only tokens that appear before the final represented name token', () => {
    expect(
      getSeoProductName({
        name: 'Case for iPhone 15',
        slug: 'case-for-apple-iphone-15',
      })
    ).toBe('Case for iPhone 15');
  });

  it('falls back to slug identifiers when generic names do not overlap', () => {
    expect(
      getSeoProductName({
        name: 'Laptop',
        slug: 'hp-elitebook-840-g5',
      })
    ).toBe('Laptop Elitebook 840 G5');
  });

  it('appends represented slug tokens when the product name has a mismatched currency symbol', () => {
    expect(
      getSeoProductName({
        name: 'PSN Gift Card €50',
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('PSN Gift Card €50 GBP');
  });

  it('spells matching currency symbols with slug currency codes for crawler-stable titles', () => {
    expect(
      getSeoProductName({
        name: 'PSN Gift Card €50',
        slug: 'psn-gift-card-eur-50',
      })
    ).toBe('PSN Gift Card €50 EUR');
  });

  it('does not append duplicate compact capacity tokens from the slug', () => {
    expect(
      getSeoProductName({
        name: 'Samsung Galaxy Tab S10 FE 5G 8 GB 128 GB',
        slug: 'samsung-galaxy-tab-s10-fe-5g-8gb-128gb',
      })
    ).toBe('Samsung Galaxy Tab S10 FE 5G 8 GB 128 GB');
  });

  it('deduplicates non-consecutive slug disambiguators while preserving order', () => {
    expect(
      getSeoProductName({
        name: 'Gaming Phone',
        slug: 'gaming-phone-8gb-red-8gb',
      })
    ).toBe('Gaming Phone 8GB RED');
  });

  it('does not append non-identifying trailing condition tokens from the slug', () => {
    expect(
      getSeoProductName({
        name: 'Apple iPhone 15',
        slug: 'apple-iphone-15-new',
      })
    ).toBe('Apple iPhone 15');
  });

  it('handles missing slugs without appending synthetic identifiers', () => {
    expect(getSeoProductName({ name: 'Test Device', slug: null })).toBe(
      'Test Device'
    );
    expect(getSeoProductName({ name: 'Test Device', slug: undefined })).toBe(
      'Test Device'
    );
  });
});

describe('normalizeSeoProductText', () => {
  it('returns an empty string for missing product metadata text', () => {
    expect(
      normalizeSeoProductText(null, {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('');
    expect(
      normalizeSeoProductText(undefined, {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('');
  });

  it('returns an empty string for empty product metadata text', () => {
    expect(
      normalizeSeoProductText('', {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('');
  });

  it('normalizes compact plus signs in explicit product metadata text', () => {
    expect(
      normalizeSeoProductText('Shop Samsung Galaxy Tab S9+ tablet today.', {
        slug: 'samsung-galaxy-tab-s9-plus',
      })
    ).toBe('Shop Samsung Galaxy Tab S9 Plus tablet today.');
  });

  it('normalizes compact plus signs before sentence punctuation', () => {
    expect(
      normalizeSeoProductText('Shop Samsung Galaxy Tab S9+.', {
        slug: 'samsung-galaxy-tab-s9-plus',
      })
    ).toBe('Shop Samsung Galaxy Tab S9 Plus.');
  });

  it('adds matching currency codes to symbol amounts in explicit metadata text', () => {
    expect(
      normalizeSeoProductText('PSN Gift Card £50 at Ogabassey: £50 value.', {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('PSN Gift Card £50 GBP at Ogabassey: £50 GBP value.');
  });

  it('adds matching currency codes before sentence punctuation', () => {
    expect(
      normalizeSeoProductText('PSN Gift Card £50. Premium price £50.99.', {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('PSN Gift Card £50 GBP. Premium price £50.99 GBP.');
  });

  it('does not duplicate currency codes that are already present', () => {
    expect(
      normalizeSeoProductText('PSN Gift Card £50 GBP Price in Nigeria', {
        slug: 'psn-gift-card-gbp-50',
      })
    ).toBe('PSN Gift Card £50 GBP Price in Nigeria');
  });
});
