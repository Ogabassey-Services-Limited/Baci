import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers catalog edge cases', () => {
  it('removes a terminal quote-only display size from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['MSI'],
      productSlugs: ['msi-modern-15-b13m-laptop-15-6'],
    });

    expect(identifiers).toEqual(['modern 15 b13m']);
  });

  it('orders ThinkPad generation tokens for guide matching', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Lenovo'],
      productSlugs: ['lenovo-thinkpad-gen-8-x1-14-inch'],
    });

    expect(identifiers).toEqual(['thinkpad x1 gen 8']);
  });

  it('retains Galaxy Buds family context in earbud identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'earbuds',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-buds-pro', 'samsung-galaxy-buds-live'],
    });

    expect(identifiers).toEqual(['galaxy buds pro', 'galaxy buds live']);
  });

  it('removes the all-in-one printer form factor from model identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'printers',
      brands: ['HP'],
      productSlugs: ['hp-smart-tank-750-all-in-one-printer'],
    });

    expect(identifiers).toEqual(['750']);
  });

  it('removes retailer configuration SKUs from convertible laptop identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-inspiron-14-7440-7304blu-2-in-1'],
    });

    expect(identifiers).toEqual(['14 7440 2 in 1']);
  });

  it('keeps a later numeric laptop model code after a display size', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-inspiron-14-7430-2-in-1'],
    });

    expect(identifiers).toEqual(['14 7430 2 in 1']);
  });

  it('preserves an HP model number that repeats the display size', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productNames: ['HP 15 15 inch i5 8GB 512GB'],
      productSlugs: [],
    });

    expect(identifiers).toEqual(['15']);
  });

  it('keeps currency discriminators for same-denomination gift cards', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'gift-cards',
      productNames: [
        'PSN Card £50 Gift Card',
        'PSN Card $50 Gift Card',
        'PSN Card €50 Gift Card',
      ],
      productSlugs: [],
    });

    expect(identifiers).toEqual(['gbp 50', 'usd 50', 'eur 50']);
  });

  it('preserves LaserJet as a printer model-family marker', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'printers',
      brands: ['HP'],
      productSlugs: ['hp-color-laserjet-pro-3203dw'],
    });

    expect(identifiers).toEqual(['color laserjet pro 3203dw']);
  });

  it('keeps a tablet generation year before an alphanumeric chip marker', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'tablets',
      brands: ['Apple'],
      productNames: ['11" iPad Pro 5th Generation 2024 M4'],
      productSlugs: [],
    });

    expect(identifiers).toEqual(['pro 5th generation 2024 m4']);
  });

  it('removes an embedded quote-only tablet dimension before capacities', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'tablets',
      brands: ['Samsung'],
      productNames: ['Samsung Tab S9 Plus 5G 12.4" 12GB 256GB'],
      productSlugs: [],
    });

    expect(identifiers).toEqual(['tab s9 plus']);
  });
});
