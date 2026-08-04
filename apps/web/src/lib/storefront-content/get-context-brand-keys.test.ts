import { describe, expect, it } from 'vitest';
import { getContextBrandKeys } from './get-context-brand-keys';

describe('getContextBrandKeys', () => {
  it('derives a canonical brand from a branded product name when context is absent', () => {
    const brandKeys = getContextBrandKeys(undefined, ['Apple iPhone 15'], {
      apple: ['apple', 'iphone'],
      samsung: ['samsung', 'galaxy'],
    });

    expect(brandKeys).toEqual(['apple']);
  });

  it('keeps explicit canonical context brands ahead of product-name aliases', () => {
    const brandKeys = getContextBrandKeys(['Xiaomi'], ['Xiaomi 14T'], {
      redmi: ['redmi', 'xiaomi'],
      xiaomi: ['xiaomi', 'redmi'],
    });

    expect(brandKeys).toEqual(['xiaomi']);
  });

  it('resolves an explicit composite brand to its canonical key', () => {
    const brandKeys = getContextBrandKeys(['Google Pixel'], undefined, {
      google: ['google', 'pixel'],
      samsung: ['samsung', 'galaxy'],
    });

    expect(brandKeys).toEqual(['google']);
  });
});
