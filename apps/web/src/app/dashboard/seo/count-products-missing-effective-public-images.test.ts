import { describe, expect, it } from 'vitest';
import { countProductsMissingEffectivePublicImages } from './count-products-missing-effective-public-images';

describe('countProductsMissingEffectivePublicImages', () => {
  it('does not count a product as missing media when its variant owns the public image', () => {
    const result = countProductsMissingEffectivePublicImages([
      {
        images: [],
        product_variants: [
          {
            primary_image: 'https://cdn.example.com/variant.webp',
            images: [],
          },
        ],
      },
    ]);

    expect(result).toBe(0);
  });

  it('counts a product as missing media when neither it nor a variant has an image', () => {
    const result = countProductsMissingEffectivePublicImages([
      { images: [], product_variants: [{ primary_image: null, images: [] }] },
    ]);

    expect(result).toBe(1);
  });

  it('keeps product-level images as an effective public image source', () => {
    const result = countProductsMissingEffectivePublicImages([
      {
        images: ['https://cdn.example.com/product.webp'],
        product_variants: [],
      },
    ]);

    expect(result).toBe(0);
  });

  it('accepts object-form media URLs from products and variants', () => {
    const result = countProductsMissingEffectivePublicImages([
      {
        images: [{ url: 'https://cdn.example.com/product.webp' }],
        product_variants: [],
      },
      {
        images: [],
        product_variants: [
          {
            primary_image: null,
            images: [{ url: 'https://cdn.example.com/variant.webp' }],
          },
        ],
      },
    ]);

    expect(result).toBe(0);
  });

  it('does not treat an inventory anchor image as public variant media', () => {
    const result = countProductsMissingEffectivePublicImages([
      {
        images: [],
        product_variants: [
          {
            primary_image: 'https://cdn.example.com/internal-anchor.webp',
            images: [],
            is_inventory_anchor: true,
          },
        ],
      },
    ]);

    expect(result).toBe(1);
  });
});
