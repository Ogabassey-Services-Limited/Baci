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

    expect(connectivity).toEqual(['wifi', 'cellular']);
  });
});
