import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers model phrases', () => {
  it('prefers a model code over dimensions, years, and capacities', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['macbook-air-13-inch-2022-m2-8gb-256gb'],
    });

    expect(identifiers).toEqual(['air m2']);
  });

  it('retains a later numeric model code after a screen-size token', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-xps-13-9350'],
    });

    expect(identifiers).toEqual(['9350']);
  });

  it('keeps the laptop family and generation together', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-probook-440-g8'],
    });

    expect(identifiers).toEqual(['probook 440 g8']);
  });

  it('preserves configured laptop family aliases', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-pavilion-15'],
    });

    expect(identifiers).toEqual(['pavilion 15']);
  });

  it('keeps MacBook line markers distinct before a chip identifier', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: [
        'macbook-air-m4-16gb-256gb-13-inch-new',
        'macbook-pro-m4-16gb-512gb-14-inch-new',
      ],
    });

    expect(identifiers).toEqual(['air m4', 'pro m4']);
  });

  it('strips a trailing processor tier from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-elitebook-840-g11-ultra-7-32gb'],
    });

    expect(identifiers).toEqual(['840 g11']);
  });

  it('strips a trailing RTX tier from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-alienware-m18-r3-rtx-5080'],
    });

    expect(identifiers).toEqual(['alienware m18 r3']);
  });

  it('strips a trailing Intel processor tier from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-probook-440-g5-14-inch-i5-8gb-256gb'],
    });

    expect(identifiers).toEqual(['probook 440 g5']);
  });

  it('strips a complete Core i-series suffix from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-precision-7540-core-i7-16gb-512gb-15-inch'],
    });

    expect(identifiers).toEqual(['precision 7540']);
  });

  it('strips a decimal display suffix before selecting the laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-xps-15-9560-15-6-4k-touchscreen'],
    });

    expect(identifiers).toEqual(['9560']);
  });

  it('strips a leading quoted display size from a laptop model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['13-macbook-air-2023-8gb-512gb-m3'],
    });

    expect(identifiers).toEqual(['air m3']);
  });

  it('strips a leading filler article before selecting a phone model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['the-iphone-11-4gb-128gb'],
    });

    expect(identifiers).toEqual(['11']);
  });

  it('retains product lines before alphanumeric laptop models', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-spectre-x360', 'hp-envy-x360'],
    });

    expect(identifiers).toEqual(['spectre x360', 'envy x360']);
  });

  it('strips a generated counter after a textual product suffix', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'printers',
      brands: ['HP'],
      productSlugs: ['hp-officejet-pro-8123-all-in-one-printer-2'],
    });

    expect(identifiers).toEqual(['officejet pro 8123 all one']);
  });

  it('preserves both numbers in a convertible model phrase', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-14-plus-2-in-1'],
    });

    expect(identifiers).toEqual(['14 plus 2 in 1']);
  });
});
