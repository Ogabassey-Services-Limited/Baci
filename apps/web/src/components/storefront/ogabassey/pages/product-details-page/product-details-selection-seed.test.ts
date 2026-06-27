import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import type { NormalizedProductDetails } from './product-normalization';
import { getSelectionImageIndex } from './product-details-selection-seed';

const productData = {
  colorImages: {
    Black: ['https://cdn.example.com/black-color-bucket.avif'],
  },
  images: [
    'https://cdn.example.com/black-color-bucket.avif',
    'https://cdn.example.com/variant-primary.avif',
  ],
} as unknown as NormalizedProductDetails;

describe('product details selection seed helpers', () => {
  it('prefers the selected variant primary image before the color bucket image', () => {
    expect(
      getSelectionImageIndex(productData, {
        attributes: { color: 'Black' },
        color: 'Black',
        price: 1000,
        variant: {
          attributes: { color: 'Black' },
          id: 'variant-used-black',
          primary_image: 'https://cdn.example.com/variant-primary.avif',
        },
      })
    ).toBe(1);
  });

  it('falls back to the first color image when the variant has no own image', () => {
    expect(
      getSelectionImageIndex(productData, {
        attributes: { color: 'Black' },
        color: 'Black',
        price: 1000,
        variant: {
          attributes: { color: 'Black' },
          id: 'variant-used-black',
        } satisfies NonNullable<Product['variants']>[number],
      })
    ).toBe(0);
  });
});
