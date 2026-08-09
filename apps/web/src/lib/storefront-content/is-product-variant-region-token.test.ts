import { describe, expect, it } from 'vitest';
import { isProductVariantRegionToken } from './is-product-variant-region-token';

describe('isProductVariantRegionToken', () => {
  it('recognizes catalog regions without treating model tiers as regions', () => {
    expect(isProductVariantRegionToken('us')).toBe(true);
    expect(isProductVariantRegionToken('uk')).toBe(true);
    expect(isProductVariantRegionToken('pro')).toBe(false);
  });

  it('does not treat the India code as an ordinary preposition', () => {
    expect(isProductVariantRegionToken('in')).toBe(false);
    expect(isProductVariantRegionToken('in', { isTerminal: true })).toBe(true);
  });
});
