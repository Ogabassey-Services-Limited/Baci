import { describe, expect, it } from 'vitest';
import { resolveProductVariantMedia } from './product-variant-media';

describe('resolveProductVariantMedia', () => {
  it('prefers variant media as the canonical color-image source', () => {
    expect(
      resolveProductVariantMedia({
        colorImages: {
          Blue: ['https://cdn.example.com/legacy-blue.jpg'],
        },
        productColors: ['Blue', 'Gold'],
        productImages: [
          'https://cdn.example.com/gold-front.jpg',
          'https://cdn.example.com/black-front.jpg',
        ],
        variants: [
          {
            attributes: { color: 'Gold', storage: '64GB' },
            primary_image: 'https://cdn.example.com/gold-front.jpg',
          },
          {
            attributes: { color: 'Space Gray', storage: '64GB' },
            primary_image: 'https://cdn.example.com/black-front.jpg',
          },
        ],
      })
    ).toEqual({
      colorImages: {
        Gold: ['https://cdn.example.com/gold-front.jpg'],
        'Space Gray': ['https://cdn.example.com/black-front.jpg'],
      },
      colors: ['Gold', 'Space Gray'],
      galleryImages: [
        'https://cdn.example.com/gold-front.jpg',
        'https://cdn.example.com/black-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/gold-front.jpg': 'Gold',
        'https://cdn.example.com/black-front.jpg': 'Space Gray',
      },
    });
  });

  it('falls back to stored color_images when variants do not provide image-driven colors', () => {
    expect(
      resolveProductVariantMedia({
        colorImages: {
          Silver: [
            'https://cdn.example.com/silver-front.jpg',
            'https://cdn.example.com/silver-back.jpg',
          ],
        },
        productImages: ['https://cdn.example.com/silver-front.jpg'],
        variants: [
          {
            attributes: { storage: '128GB' },
            primary_image: null,
          },
        ],
      })
    ).toEqual({
      colorImages: {
        Silver: [
          'https://cdn.example.com/silver-front.jpg',
          'https://cdn.example.com/silver-back.jpg',
        ],
      },
      colors: ['Silver'],
      galleryImages: [
        'https://cdn.example.com/silver-front.jpg',
        'https://cdn.example.com/silver-back.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/silver-front.jpg': 'Silver',
        'https://cdn.example.com/silver-back.jpg': 'Silver',
      },
    });
  });
});
