import { describe, expect, it } from 'vitest';
import { getProductConnectivityDiscriminator } from './get-product-connectivity-discriminator';

describe('getProductConnectivityDiscriminator', () => {
  it('extracts normalized connectivity from product names before slugs', () => {
    const connectivity = getProductConnectivityDiscriminator(
      ['Samsung A15 5G'],
      ['samsung-a15-lte']
    );

    expect(connectivity).toBe('5g');
  });
});
