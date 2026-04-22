import { describe, expect, it } from 'vitest';
import { deriveProductVariantWriteProjections } from './derive-product-variant-projections';

describe('deriveProductVariantWriteProjections', () => {
  it('keeps the authored parent color for simple products', () => {
    expect(
      deriveProductVariantWriteProjections({
        fallbackColor: 'Midnight Blue',
        hasVariants: false,
      })
    ).toEqual({
      color: 'Midnight Blue',
    });
  });

  it('projects the parent color from variant media for variant products', () => {
    expect(
      deriveProductVariantWriteProjections({
        fallbackColor: 'Legacy Blue',
        hasVariants: true,
        variants: [
          {
            attributes: { color: 'Green', storage: '64GB' },
            primary_image: 'https://cdn.example.com/green.jpg',
          },
          {
            attributes: { color: 'Gold', storage: '64GB' },
            primary_image: 'https://cdn.example.com/gold.jpg',
          },
        ],
      })
    ).toEqual({
      color: 'Green',
    });
  });
});
