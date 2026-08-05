import { describe, expect, it } from 'vitest';
import { getProductConnectivityDiscriminators } from './get-product-connectivity-discriminator';

describe('getProductConnectivityDiscriminators', () => {
  it('extracts normalized connectivity from product names before slugs', () => {
    const connectivity = getProductConnectivityDiscriminators(
      ['Samsung A15 5G'],
      ['samsung-a15-lte']
    );

    expect(connectivity).toEqual(['5g']);
  });

  it('retains every connectivity marker from a multi-connectivity PDP', () => {
    const connectivity = getProductConnectivityDiscriminators(
      ['iPad 10th Gen 2022 256GB Wi-Fi + Cellular'],
      []
    );

    expect(connectivity).toEqual(['256gb', 'wifi', 'cellular']);
  });

  it('uses storage while excluding ordinary RAM markers when connectivity is absent', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15 6GB 256GB'],
      []
    );

    expect(discriminators).toEqual(['256gb']);
  });

  it('retains SIM mode markers with storage and connectivity variants', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15 256GB 5G physical SIM'],
      []
    );

    expect(discriminators).toEqual(['256gb', '5g', 'physical', 'sim']);
  });

  it('retains 32GB storage while excluding the smaller RAM marker', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Samsung A05 4GB 32GB'],
      []
    );

    expect(discriminators).toEqual(['32gb']);
  });

  it('normalizes compact G storage suffixes as GB variants', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15 256G'],
      []
    );

    expect(discriminators).toEqual(['256gb']);
  });

  it('does not treat a lone 32GB laptop memory suffix as storage', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Dell XPS 13 9340 Intel Core Ultra 7 32GB'],
      [],
      'laptops'
    );

    expect(discriminators).toEqual([]);
  });

  it('uses aligned slug storage when a laptop name only contains RAM', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Dell XPS 13 16GB'],
      ['dell-xps-13-512gb'],
      'laptops'
    );

    expect(discriminators).toEqual(['512gb']);
  });

  it('retains normalized Bluetooth and GPS markers stripped from model names', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Samsung Watch 9 45mm BT GPS'],
      []
    );

    expect(discriminators).toEqual(['45mm', 'bluetooth', 'gps']);
  });

  it('retains detailed SIM mode markers stripped from model names', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15 dual nano SIM'],
      []
    );

    expect(discriminators).toEqual(['dual', 'nano', 'sim']);
  });

  it('merges variant metadata from an aligned PDP slug', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15'],
      ['apple-iphone-15-256gb']
    );

    expect(discriminators).toEqual(['256gb']);
  });

  it('supplements name-side SIM mode with slug-side network generation', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Samsung A15 Dual SIM'],
      ['samsung-a15-5g-dual-sim']
    );

    expect(discriminators).toEqual(['dual', 'sim', '5g']);
  });

  it('retains watch case dimensions as PDP discriminators', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple Watch Series 9 45mm'],
      []
    );

    expect(discriminators).toEqual(['45mm']);
  });

  it('retains a terminal PDP color as a variant discriminator', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Apple iPhone 15 Blue'],
      []
    );

    expect(discriminators).toEqual(['blue']);
  });
});
