import { describe, expect, it } from 'vitest';
import { buildProductImagesInput } from './build-product-images-input';

describe('buildProductImagesInput', () => {
  it('keeps supplied images rather than replacing their metadata', () => {
    const images = [
      { url: 'https://cdn.example/one.jpg', alt: 'One', order: 2 },
    ];

    expect(
      buildProductImagesInput(
        images,
        'https://cdn.example/fallback.jpg',
        'Fallback'
      )
    ).toBe(images);
  });

  it('creates one accessible fallback image when no image list exists', () => {
    expect(
      buildProductImagesInput(
        undefined,
        'https://cdn.example/fallback.jpg',
        'New product'
      )
    ).toEqual([
      { url: 'https://cdn.example/fallback.jpg', alt: 'New product', order: 0 },
    ]);
  });

  it('returns no images when neither input has an image', () => {
    expect(buildProductImagesInput([], null, 'New product')).toEqual([]);
  });
});
