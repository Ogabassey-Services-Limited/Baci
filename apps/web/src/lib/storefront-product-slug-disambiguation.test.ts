import { describe, expect, it } from 'vitest';
import { getSeoProductName } from './storefront-product-slug-disambiguation';

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
    ).toBe('PSN Gift Card £50');
  });

  it('does not append duplicate compact capacity tokens from the slug', () => {
    expect(
      getSeoProductName({
        name: 'Samsung Galaxy Tab S10 FE 5G 8 GB 128 GB',
        slug: 'samsung-galaxy-tab-s10-fe-5g-8gb-128gb',
      })
    ).toBe('Samsung Galaxy Tab S10 FE 5G 8 GB 128 GB');
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
