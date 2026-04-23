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
        Blue: ['https://cdn.example.com/legacy-blue.jpg'],
        Gold: ['https://cdn.example.com/gold-front.jpg'],
        'Space Gray': ['https://cdn.example.com/black-front.jpg'],
      },
      colors: ['Blue', 'Gold', 'Space Gray'],
      galleryImages: [
        'https://cdn.example.com/legacy-blue.jpg',
        'https://cdn.example.com/gold-front.jpg',
        'https://cdn.example.com/black-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/legacy-blue.jpg': 'Blue',
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

  it('keeps fallback product colors when variant images only cover some colors', () => {
    expect(
      resolveProductVariantMedia({
        productColors: ['Blue', 'Gold'],
        productImages: [
          'https://cdn.example.com/blue-front.jpg',
          'https://cdn.example.com/gold-front.jpg',
        ],
        variants: [
          {
            attributes: { color: 'Blue', storage: '128GB' },
            primary_image: 'https://cdn.example.com/blue-front.jpg',
          },
          {
            attributes: { color: 'Gold', storage: '128GB' },
            primary_image: null,
          },
        ],
      })
    ).toEqual({
      colorImages: {
        Blue: ['https://cdn.example.com/blue-front.jpg'],
      },
      colors: ['Blue', 'Gold'],
      galleryImages: [
        'https://cdn.example.com/blue-front.jpg',
        'https://cdn.example.com/gold-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/blue-front.jpg': 'Blue',
      },
    });
  });

  it('uses stored color images and product images when variants are empty', () => {
    expect(
      resolveProductVariantMedia({
        colorImages: {
          Gold: ['https://cdn.example.com/gold-front.jpg'],
        },
        productColors: ['Gold', 'Blue'],
        productImages: [
          'https://cdn.example.com/gold-front.jpg',
          'https://cdn.example.com/blue-front.jpg',
        ],
        variants: [],
      })
    ).toEqual({
      colorImages: {
        Gold: ['https://cdn.example.com/gold-front.jpg'],
      },
      colors: ['Gold', 'Blue'],
      galleryImages: [
        'https://cdn.example.com/gold-front.jpg',
        'https://cdn.example.com/blue-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/gold-front.jpg': 'Gold',
      },
    });
  });

  it('handles missing stored color images gracefully', () => {
    expect(
      resolveProductVariantMedia({
        colorImages: {},
        productColors: ['Gold'],
        productImages: ['https://cdn.example.com/gold-front.jpg'],
        variants: [
          {
            attributes: { storage: '128GB' },
            primary_image: null,
          },
        ],
      })
    ).toEqual({
      colorImages: undefined,
      colors: ['Gold'],
      galleryImages: ['https://cdn.example.com/gold-front.jpg'],
      imageColorMap: {},
    });
  });

  it('merges variant color images on top of legacy data and preserves all colors', () => {
    expect(
      resolveProductVariantMedia({
        colorImages: {
          Gold: ['https://cdn.example.com/gold-back.jpg'],
          Silver: ['https://cdn.example.com/silver-front.jpg'],
        },
        productColors: ['Gold', 'Silver', 'Blue'],
        productImages: [
          'https://cdn.example.com/gold-front.jpg',
          'https://cdn.example.com/silver-front.jpg',
          'https://cdn.example.com/blue-front.jpg',
        ],
        variants: [
          {
            attributes: { color: 'Gold', storage: '64GB' },
            primary_image: 'https://cdn.example.com/gold-front.jpg',
          },
          {
            attributes: { color: 'Blue', storage: '64GB' },
            primary_image: null,
          },
        ],
      })
    ).toEqual({
      colorImages: {
        Gold: ['https://cdn.example.com/gold-front.jpg'],
        Silver: ['https://cdn.example.com/silver-front.jpg'],
      },
      colors: ['Gold', 'Silver', 'Blue'],
      galleryImages: [
        'https://cdn.example.com/gold-front.jpg',
        'https://cdn.example.com/silver-front.jpg',
        'https://cdn.example.com/blue-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/gold-front.jpg': 'Gold',
        'https://cdn.example.com/silver-front.jpg': 'Silver',
      },
    });
  });

  it('deduplicates colors case-insensitively across sources and preserves first-seen casing', () => {
    // Arrange: legacy color_images uses lowercase `black` while product.colors
    // uses title-case `Black`; they should collapse into a single swatch.
    const result = resolveProductVariantMedia({
      colorImages: {
        black: ['https://cdn.example.com/black.jpg'],
      },
      productColors: ['Black', 'RED', 'red'],
      productImages: [],
      variants: [],
    });

    // Assert: single entry per color; first occurrence (lowercase `black` from
    // color_images) wins, later casings (`RED` before `red`) also collapse.
    expect(result.colors).toEqual(['black', 'RED']);
  });

  it('normalizes image objects and strips surrounding quotes from URLs', () => {
    expect(
      resolveProductVariantMedia({
        variants: [
          {
            attributes: { color: 'Blue' },
            image: { url: '"https://cdn.example.com/quoted-blue.jpg" ' },
          },
          {
            attributes: { color: 'Gold' },
            images: [{ url: ' https://cdn.example.com/object-gold.jpg ' }],
          },
        ],
      })
    ).toEqual({
      colorImages: {
        Blue: ['https://cdn.example.com/quoted-blue.jpg'],
        Gold: ['https://cdn.example.com/object-gold.jpg'],
      },
      colors: ['Blue', 'Gold'],
      galleryImages: [
        'https://cdn.example.com/quoted-blue.jpg',
        'https://cdn.example.com/object-gold.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/quoted-blue.jpg': 'Blue',
        'https://cdn.example.com/object-gold.jpg': 'Gold',
      },
    });
  });
});
