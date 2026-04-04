import {
  getProductCardImageAttempt,
  getPrimaryProductImage,
  mergeVariantAttributes,
  normalizeProductImages,
  normalizeProductSpecifications,
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

  it('normalizes string-array variant attributes into axes with empty options', () => {
    expect(normalizeVariantAttributes(['Storage', 'RAM'])).toEqual({
      storage: [],
      ram: [],
    });
  });
});

describe('mergeVariantAttributes', () => {
  it('merges axes discovered only on live variant rows into the product attribute map', () => {
    expect(
      mergeVariantAttributes(
        [{ param: 'storage', options: ['256GB', '512GB'] }],
        [
          { attributes: { ram: '12GB', storage: '256GB' } },
          { attributes: { ram: '12GB', storage: '512GB' } },
        ]
      )
    ).toEqual({
      ram: ['12GB'],
      storage: ['256GB', '512GB'],
    });
  });
});

describe('normalizeProductImages', () => {
  it('returns same array when all images are valid', () => {
    const images = [
      'https://cdn.example.com/iphone-13-pro-front.jpg',
      'https://cdn.example.com/iphone-13-pro-back.jpg',
    ];

    expect(normalizeProductImages(images)).toEqual(images);
  });

  it('returns empty array for empty input', () => {
    expect(normalizeProductImages([])).toEqual([]);
  });

  it('handles undefined input', () => {
    expect(normalizeProductImages(undefined)).toEqual([]);
  });

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

  it('normalizes object-based image entries', () => {
    expect(
      normalizeProductImages([
        { url: 'https://cdn.example.com/iphone-13-pro-front.jpg' },
        { src: 'https://cdn.example.com/iphone-13-pro-back.jpg' },
        { uri: 'https://cdn.example.com/iphone-13-pro-side.jpg' },
      ])
    ).toEqual([
      'https://cdn.example.com/iphone-13-pro-front.jpg',
      'https://cdn.example.com/iphone-13-pro-back.jpg',
      'https://cdn.example.com/iphone-13-pro-side.jpg',
    ]);
  });
});

describe('normalizeProductSpecifications', () => {
  it('flattens section-based live specifications into a record', () => {
    expect(
      normalizeProductSpecifications([
        {
          category: 'Display',
          items: [
            { label: 'Brand', value: 'HP' },
            { label: 'Refresh Rate', value: 165 },
          ],
        },
        {
          category: 'Battery',
          items: [{ label: 'Fast Charging', value: true }],
        },
      ])
    ).toEqual({
      Brand: 'HP',
      'Fast Charging': 'true',
      'Refresh Rate': '165',
    });
  });

  it('normalizes object-map specifications and drops empty values', () => {
    expect(
      normalizeProductSpecifications({
        RAM: '16GB',
        Storage: '1TB SSD',
        Empty: '',
        Nullish: null,
      })
    ).toEqual({
      RAM: '16GB',
      Storage: '1TB SSD',
    });
  });
});

describe('getPrimaryProductImage', () => {
  it('returns the first normalized product image when image array is provided', () => {
    expect(
      getPrimaryProductImage([
        'https://cdn.example.com/image1.jpg',
        'https://cdn.example.com/image2.jpg',
      ])
    ).toBe('https://cdn.example.com/image1.jpg');
  });

  it('falls back to the placeholder image when no product image exists', () => {
    expect(getPrimaryProductImage(null)).toBe(PRODUCT_PLACEHOLDER_IMAGE);
  });
});

describe('getProductCardImageAttempt', () => {
  it('returns the first image when attempt is 0', () => {
    expect(
      getProductCardImageAttempt(
        ['https://cdn.example.com/redmi-pad-se-working.avif'],
        0
      )
    ).toBe('https://cdn.example.com/redmi-pad-se-working.avif');
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

  it('returns the placeholder when attempt is negative', () => {
    expect(
      getProductCardImageAttempt(
        ['https://cdn.example.com/redmi-pad-se-working.avif'],
        -1
      )
    ).toBe(PRODUCT_PLACEHOLDER_IMAGE);
  });

  it('returns the placeholder when attempt is not an integer', () => {
    expect(
      getProductCardImageAttempt(
        ['https://cdn.example.com/redmi-pad-se-working.avif'],
        1.5
      )
    ).toBe(PRODUCT_PLACEHOLDER_IMAGE);
  });
});
