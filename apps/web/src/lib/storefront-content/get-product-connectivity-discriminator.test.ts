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

  it('does not treat a lone 32GB laptop memory suffix as storage', () => {
    const discriminators = getProductConnectivityDiscriminators(
      ['Dell XPS 13 9340 Intel Core Ultra 7 32GB'],
      [],
      'laptops'
    );

    expect(discriminators).toEqual([]);
  });
});
