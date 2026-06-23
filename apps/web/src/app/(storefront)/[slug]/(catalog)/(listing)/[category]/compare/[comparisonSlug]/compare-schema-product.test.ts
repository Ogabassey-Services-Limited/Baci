import { describe, expect, it } from 'vitest';
import {
  getRecord,
  getStructuredDataAvailability,
  getStructuredDataImage,
  normalizeStructuredDataImageUrl,
  toOptionalNumber,
  toProductCompareSchemaProduct,
} from './compare-schema-product';

const BASE_URL = 'https://ogabassey.com/smartphones/compare/a-vs-b';

describe('compare schema product helpers', () => {
  it('reads plain records and rejects arrays or nullish values', () => {
    expect(getRecord({ id: 'product-1' })).toEqual({ id: 'product-1' });
    expect(getRecord([])).toBeNull();
    expect(getRecord(null)).toBeNull();
  });

  it('normalizes structured-data image URLs and rejects placeholders', () => {
    expect(normalizeStructuredDataImageUrl('/media/phone.avif', BASE_URL)).toBe(
      'https://ogabassey.com/media/phone.avif'
    );
    expect(
      normalizeStructuredDataImageUrl(
        'https://cdn.example.com/phone.avif',
        BASE_URL
      )
    ).toBe('https://cdn.example.com/phone.avif');
    expect(normalizeStructuredDataImageUrl('/placeholder.svg', BASE_URL)).toBe(
      ''
    );
    expect(
      normalizeStructuredDataImageUrl(
        'https://ogabassey.com/placeholder.svg?cache=1',
        BASE_URL
      )
    ).toBe('');
    expect(
      normalizeStructuredDataImageUrl('mailto:test@example.com', BASE_URL)
    ).toBe('');
  });

  it('falls back through product image candidates', () => {
    expect(
      getStructuredDataImage(
        {
          image: '/placeholder.svg',
          images: [
            '/media/fallback.avif',
            { url: 'https://cdn.example.com/ignored.avif' },
          ],
        },
        BASE_URL
      )
    ).toBe('https://ogabassey.com/media/fallback.avif');

    expect(
      getStructuredDataImage(
        {
          image: null,
          images: [{ url: 'https://cdn.example.com/object.avif' }],
        },
        BASE_URL
      )
    ).toBe('https://cdn.example.com/object.avif');
  });

  it('coerces optional numbers conservatively', () => {
    expect(toOptionalNumber(1299)).toBe(1299);
    expect(toOptionalNumber('1299.50')).toBe(1299.5);
    expect(toOptionalNumber('')).toBeNull();
    expect(toOptionalNumber(Number.NaN)).toBeNull();
    expect(toOptionalNumber('not-a-number')).toBeNull();
  });

  it.each([
    [{ availability: 'InStock' }, 'InStock'],
    [{ availability: 'out_of_stock' }, 'OutOfStock'],
    [{ availability: 'instock' }, 'InStock'],
    [{ in_stock: false }, 'OutOfStock'],
    [{ status: 'sold_out', manage_stock: false }, 'OutOfStock'],
    [{ manage_stock: false, stock_quantity: '0' }, 'InStock'],
    [{ manage_stock: null, stock_quantity: '0' }, 'InStock'],
    [{ stock_quantity: '0' }, 'InStock'],
    [{ stock: 0 }, 'InStock'],
    [{ manage_stock: true, stock_quantity: '0' }, 'OutOfStock'],
    [{ manage_stock: true, stock: 3 }, 'InStock'],
    [{}, undefined],
  ] as const)('normalizes availability from %j', (product, availability) => {
    expect(getStructuredDataAvailability(product)).toBe(availability);
  });

  it('builds product schema input when required fields are present', () => {
    expect(
      toProductCompareSchemaProduct(
        {
          id: 123,
          name: '  iPhone 17 Pro Max  ',
          image: '/media/iphone.avif',
          availability: 'outofstock',
          category: 'Smartphones',
          category_slug: 'smartphones',
          description: 'Flagship phone',
          price: '2999999',
          slug: 'iphone-17-pro-max',
        },
        BASE_URL
      )
    ).toEqual({
      id: '123',
      name: 'iPhone 17 Pro Max',
      image: 'https://ogabassey.com/media/iphone.avif',
      availability: 'OutOfStock',
      category: 'Smartphones',
      category_slug: 'smartphones',
      description: 'Flagship phone',
      price: 2_999_999,
      slug: 'iphone-17-pro-max',
    });
  });

  it.each([
    [null],
    [{ id: '', name: 'Phone', image: '/media/phone.avif' }],
    [{ id: 'phone-1', name: '   ', image: '/media/phone.avif' }],
    [{ id: 'phone-1', name: 'Phone', image: '/placeholder.svg' }],
  ])('returns null for invalid schema product input %j', (product) => {
    expect(toProductCompareSchemaProduct(product, BASE_URL)).toBeNull();
  });
});
