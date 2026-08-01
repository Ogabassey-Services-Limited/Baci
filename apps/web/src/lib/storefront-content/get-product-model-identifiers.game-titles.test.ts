import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers game titles', () => {
  it('retains annual game years after an alphanumeric platform token', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'playstation-4',
      productSlugs: ['ps4-f1-2018', 'ps4-f1-2024'],
    });

    expect(identifiers).toEqual(['f1 2018', 'f1 2024']);
  });

  it('preserves sequel numbers after a PlayStation platform generation', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'playstation-4',
      productSlugs: ['ps4-resident-evil-4-remake'],
    });

    expect(identifiers).toEqual(['resident evil 4 remake']);
  });

  it('keeps generic game words that are not a brand alias', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'nintendo-switch',
      productSlugs: ['nintendo-switch-hasbro-game-night'],
    });

    expect(identifiers).toEqual(['hasbro game night']);
  });

  it('preserves region words inside game titles', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'playstation-4',
      productSlugs: ['ps4-last-of-us-2'],
    });

    expect(identifiers).toEqual(['last of us 2']);
  });

  it('preserves an in-token inside a Nintendo Switch title', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'nintendo-switch',
      productSlugs: ['nintendo-switch-hat-in-time'],
    });

    expect(identifiers).toEqual(['hat in time']);
  });

  it('preserves a game title that contains new', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'playstation-4',
      productSlugs: ['ps4-farcry-new-dawn'],
    });

    expect(identifiers).toEqual(['farcry new dawn']);
  });

  it('preserves single-letter game-title tokens', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'nintendo-switch',
      productSlugs: ['nintendo-switch-new-super-mario-bros-u-deluxe'],
    });

    expect(identifiers).toEqual(['new super mario bros u deluxe']);
  });

  it('expands compact alphanumeric game codes for guide matching', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'playstation-4',
      productSlugs: ['ps4-fc24', 'ps4-fc25'],
    });

    expect(identifiers).toEqual(['fc 24', 'fc 25']);
  });

  it('retains consecutive numeric game-title endings', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'nintendo-switch',
      productSlugs: ['nintendo-switch-1-2-switch'],
    });

    expect(identifiers).toEqual(['1 2']);
  });

  it('preserves a sub-10-inch tablet display prefix as metadata', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'tablets',
      brands: ['Apple'],
      productSlugs: ['8-3-ipad-mini-6th-generation-2021'],
    });

    expect(identifiers).toEqual(['mini 6th generation']);
  });

  it('retains the Series marker for an Apple Watch SE identifier', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartwatches',
      brands: ['Apple'],
      productSlugs: ['apple-watch-series-se-40mm-gps'],
    });

    expect(identifiers).toEqual(['watch series se']);
  });
});
