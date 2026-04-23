import { describe, expect, it } from '@jest/globals';
import { resolveProductVariantMetadata } from './product-variant-metadata';

describe('resolveProductVariantMetadata', () => {
  it('prefers exact variant colors over generic product-level color options', () => {
    expect(
      resolveProductVariantMetadata({
        colorImages: {
          Blue: ['https://cdn.example.com/generic-blue.jpg'],
        },
        productImages: [
          'https://cdn.example.com/black-front.jpg',
          'https://cdn.example.com/blue-front.jpg',
        ],
        productColors: ['Blue'],
        sourceVariantAttributes: {
          color: ['Blue'],
          storage: ['128GB', '256GB'],
        },
        variants: [
          {
            id: 'variant-128',
            name: '128GB',
            price: 600000,
            image: 'https://cdn.example.com/blue-front.jpg',
            attributes: {
              color: 'Sapphire Blue',
              storage: '128GB',
            },
          },
          {
            id: 'variant-256',
            name: '256GB',
            price: 680000,
            image: 'https://cdn.example.com/black-front.jpg',
            attributes: {
              color: 'Onyx Black',
              storage: '256GB',
            },
          },
        ],
      })
    ).toEqual({
      colorImages: {
        'Onyx Black': ['https://cdn.example.com/black-front.jpg'],
        'Sapphire Blue': ['https://cdn.example.com/blue-front.jpg'],
      },
      colors: ['Sapphire Blue', 'Onyx Black'],
      galleryImages: [
        'https://cdn.example.com/blue-front.jpg',
        'https://cdn.example.com/black-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/black-front.jpg': 'Onyx Black',
        'https://cdn.example.com/blue-front.jpg': 'Sapphire Blue',
      },
      variantAttributes: {
        color: ['Sapphire Blue', 'Onyx Black'],
        storage: ['128GB', '256GB'],
      },
    });
  });
});
