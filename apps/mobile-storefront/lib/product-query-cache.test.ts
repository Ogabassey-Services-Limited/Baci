import type { Product } from '@/types/product';
import { removeProductSlugFromProductsCache } from './product-query-cache';

function createProduct(overrides: Partial<Product>): Product {
  return {
    id: 'product-id',
    name: 'Product name',
    slug: 'product-slug',
    price: 1000,
    image: 'https://cdn.example.com/product.avif',
    images: ['https://cdn.example.com/product.avif'],
    category: 'Phones',
    rating: 4.5,
    review_count: 0,
    in_stock: true,
    ...overrides,
  };
}

describe('removeProductSlugFromProductsCache', () => {
  it('returns the original value for falsy or non-products cache inputs', () => {
    const nonCache = { foo: 'bar' };

    expect(removeProductSlugFromProductsCache(undefined, 'iphone-13-pro')).toBe(
      undefined
    );
    expect(removeProductSlugFromProductsCache(null, 'iphone-13-pro')).toBe(
      null
    );
    expect(removeProductSlugFromProductsCache(nonCache, 'iphone-13-pro')).toBe(
      nonCache
    );
  });

  it('removes a deleted slug from every cached page and adjusts totals', () => {
    const cache = {
      pages: [
        {
          products: [
            createProduct({ id: '1', slug: 'iphone-13-pro' }),
            createProduct({
              id: '2',
              slug: 'iphone-13-pro-128gb-premium-used',
            }),
          ],
          nextOffset: 2,
          total: 3,
        },
        {
          products: [
            createProduct({
              id: '3',
              slug: 'iphone-13-pro-128gb-premium-used',
            }),
          ],
          nextOffset: null,
          total: 3,
        },
      ],
      pageParams: [0, 2],
    };

    expect(
      removeProductSlugFromProductsCache(
        cache,
        'iphone-13-pro-128gb-premium-used'
      )
    ).toEqual({
      pages: [
        {
          products: [createProduct({ id: '1', slug: 'iphone-13-pro' })],
          nextOffset: 2,
          total: 1,
        },
        {
          products: [],
          nextOffset: null,
          total: 1,
        },
      ],
      pageParams: [0, 2],
    });
  });

  it('returns the original cache when the slug is not present', () => {
    const cache = {
      pages: [
        {
          products: [createProduct({ id: '1', slug: 'iphone-13-pro' })],
          nextOffset: null,
          total: 1,
        },
      ],
      pageParams: [0],
    };

    expect(removeProductSlugFromProductsCache(cache, 'missing-slug')).toBe(
      cache
    );
  });

  it('returns the original cache when slug is empty', () => {
    const cache = {
      pages: [
        {
          products: [createProduct({ id: '1', slug: 'iphone-13-pro' })],
          nextOffset: null,
          total: 1,
        },
      ],
      pageParams: [0],
    };

    expect(removeProductSlugFromProductsCache(cache, '')).toBe(cache);
  });
});
