import {
  getProductCardImageAttempt,
  getPrimaryProductImage,
  normalizeProductImages,
  normalizeVariantAttributes,
  PRODUCT_PLACEHOLDER_IMAGE,
} from './product-normalization';

describe('normalizeVariantAttributes', () => {
  it('normalizes array-based variant attributes', () => {
    expect(
      normalizeVariantAttributes([
        { param: 'storage', options: ['128GB', '256GB', '512GB'] },
      ])
    ).toEqual({
      storage: ['128GB', '256GB', '512GB'],
    });
  });

  it('normalizes legacy object-map variant attributes', () => {
    expect(
      normalizeVariantAttributes({
        Storage: ['128GB', '256GB'],
        'SIM Type': 'Physical + eSIM',
        Color: null,
      })
    ).toEqual({
      sim_type: ['Physical + eSIM'],
      storage: ['128GB', '256GB'],
    });
  });
});

describe('normalizeProductImages', () => {
  it('filters empty image values', () => {
    expect(
      normalizeProductImages([
        '',
        '   ',
        'https://cdn.example.com/iphone-13-pro.jpg',
        null,
      ])
    ).toEqual(['https://cdn.example.com/iphone-13-pro.jpg']);
  });

  it('falls back to the placeholder image when no product image exists', () => {
    expect(getPrimaryProductImage(null)).toBe(PRODUCT_PLACEHOLDER_IMAGE);
  });

  it('returns the next real image before using the placeholder', () => {
    expect(
      getProductCardImageAttempt(
        [
          'https://cdn.example.com/redmi-pad-se-broken.avif',
          'https://cdn.example.com/redmi-pad-se-working.avif',
        ],
        1
      )
    ).toBe('https://cdn.example.com/redmi-pad-se-working.avif');
  });

  it('uses the placeholder once all image attempts are exhausted', () => {
    expect(
      getProductCardImageAttempt(
        ['https://cdn.example.com/redmi-pad-se-broken.avif'],
        1
      )
    ).toBe(PRODUCT_PLACEHOLDER_IMAGE);
  });
});
