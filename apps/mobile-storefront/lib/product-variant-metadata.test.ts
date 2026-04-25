import { describe, expect, it } from '@jest/globals';
import { resolveProductVariantMetadata } from './product-variant-metadata';

describe('resolveProductVariantMetadata', () => {
  it('unions imaged variant colors with metadata-only colors when both exist', () => {
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
        Blue: ['https://cdn.example.com/generic-blue.jpg'],
        'Onyx Black': ['https://cdn.example.com/black-front.jpg'],
        'Sapphire Blue': ['https://cdn.example.com/blue-front.jpg'],
      },
      // 'Blue' stays in the list because it is a valid image-backed product
      // color option even though no variant row carries that exact color.
      colors: ['Blue', 'Sapphire Blue', 'Onyx Black'],
      galleryImages: [
        'https://cdn.example.com/generic-blue.jpg',
        'https://cdn.example.com/blue-front.jpg',
        'https://cdn.example.com/black-front.jpg',
      ],
      imageColorMap: {
        'https://cdn.example.com/black-front.jpg': 'Onyx Black',
        'https://cdn.example.com/blue-front.jpg': 'Sapphire Blue',
        'https://cdn.example.com/generic-blue.jpg': 'Blue',
      },
      variantAttributes: {
        color: ['Blue', 'Sapphire Blue', 'Onyx Black'],
        storage: ['128GB', '256GB'],
      },
    });
  });

  it('preserves metadata-only colors in the imaged branch even when no variants declare them', () => {
    const result = resolveProductVariantMetadata({
      colorImages: {
        Blue: ['https://cdn.example.com/blue.jpg'],
      },
      productImages: ['https://cdn.example.com/blue.jpg'],
      // Legacy catalog: Green exists as a product color option but has no
      // dedicated image and no variant row. It must stay selectable.
      productColors: ['Blue', 'Green'],
      variants: [
        {
          id: 'variant-blue',
          name: 'Blue',
          price: 100,
          image: 'https://cdn.example.com/blue.jpg',
          attributes: { color: 'Blue' },
        },
      ],
    });

    expect(result.colors).toEqual(expect.arrayContaining(['Blue', 'Green']));
    expect(result.variantAttributes?.color).toEqual(
      expect.arrayContaining(['Blue', 'Green'])
    );
  });

  it('preserves non-imaged variant colors when some colors are image-backed', () => {
    const result = resolveProductVariantMetadata({
      productImages: ['https://cdn.example.com/blue-front.jpg'],
      variants: [
        {
          id: 'variant-blue',
          name: 'Blue',
          price: 100,
          image: 'https://cdn.example.com/blue-front.jpg',
          attributes: {
            color: 'Blue',
          },
        },
        {
          id: 'variant-red',
          name: 'Red',
          price: 100,
          attributes: {
            color: 'Red',
          },
        },
      ],
    });

    // Red has no image but is a valid variant color — must remain selectable.
    expect(result.colors).toEqual(expect.arrayContaining(['Blue', 'Red']));
    expect(result.variantAttributes?.color).toEqual(
      expect.arrayContaining(['Blue', 'Red'])
    );
  });

  it('derives selectable colors from the legacy `colour` attribute key', () => {
    const result = resolveProductVariantMetadata({
      variants: [
        {
          id: 'variant-green',
          name: 'Green',
          price: 100,
          attributes: {
            colour: 'Forest Green',
          },
        },
        {
          id: 'variant-red',
          name: 'Red',
          price: 100,
          attributes: {
            colour: 'Crimson',
          },
        },
      ],
    });

    expect(result.colors).toEqual(['Forest Green', 'Crimson']);
    expect(result.variantAttributes).toEqual({
      colour: ['Forest Green', 'Crimson'],
      color: ['Forest Green', 'Crimson'],
    });
  });
});
