import { describe, expect, it } from 'vitest';
import { buildProductSitemapEntry } from '@/app/(storefront)/[slug]/build-product-sitemap-entry';
import { getValidatedProductUrl } from '@/lib/seo-utils';
import { buildAgentProductUrl } from '@/lib/storefront-agent-urls';

describe('storefront public product URL serialization', () => {
  it('preserves raw reserved delimiters as one encoded path segment across consumers', () => {
    const product = {
      id: 'watch-1',
      name: 'Watch Pro',
      slug: 'watch?pro#gps',
      category: 'Smart Watches',
      category_slug: 'smart?watches#gps',
      canonical_url: null,
    };
    const expected =
      'https://store.example/smart%3Fwatches%23gps/watch%3Fpro%23gps';

    expect(getValidatedProductUrl(product, 'https://store.example')).toBe(
      expected
    );
    expect(
      buildAgentProductUrl({ baseUrl: 'https://store.example', product })
    ).toBe(expected);
    expect(
      buildProductSitemapEntry({
        product: {
          ...product,
          images: [],
          updated_at: null,
          categories: { slug: product.category_slug },
        },
        storeUrl: 'https://store.example',
      }).url
    ).toBe(expected);
  });

  it('converges raw and already-encoded product path segments without double encoding', () => {
    const rawUrl = getValidatedProductUrl(
      {
        id: 'watch-1',
        name: 'Watch Pro',
        slug: 'watch?pro#gps',
        category_slug: 'smart?watches#gps',
      },
      'https://store.example'
    );
    const encodedUrl = getValidatedProductUrl(
      {
        id: 'watch-1',
        name: 'Watch Pro',
        slug: 'watch%3Fpro%23gps',
        category_slug: 'smart%3Fwatches%23gps',
      },
      'https://store.example'
    );

    expect(encodedUrl).toBe(rawUrl);
  });

  it('converges decoded whitespace before serializing category and product segments', () => {
    const rawUrl = getValidatedProductUrl(
      {
        id: 'watch-2',
        name: 'Watch',
        slug: ' watch ',
        category_slug: ' smart watches ',
      },
      'https://store.example'
    );
    const encodedUrl = getValidatedProductUrl(
      {
        id: 'watch-2',
        name: 'Watch',
        slug: '%20watch%20',
        category_slug: '%20smart%20watches%20',
      },
      'https://store.example'
    );

    expect(rawUrl).toBe('https://store.example/smart%20watches/watch');
    expect(encodedUrl).toBe(rawUrl);
  });

  it('preserves a development storefront path prefix for fallback product URLs', () => {
    const url = getValidatedProductUrl(
      {
        id: 'laptop-1',
        name: 'Laptop',
        slug: 'laptop',
        category_slug: 'laptops',
        canonical_url: null,
      },
      'http://localhost:3000/ogabassey/?preview=true#products'
    );

    expect(url).toBe('http://localhost:3000/ogabassey/laptops/laptop');
  });

  it('preserves a development storefront path prefix for accepted stored canonicals', () => {
    const product = {
      id: 'laptop-1',
      name: 'Laptop',
      slug: 'laptop',
      category_slug: 'laptops',
    };

    expect(
      getValidatedProductUrl(
        { ...product, canonical_url: '/laptops/laptop' },
        'http://localhost:3000/ogabassey'
      )
    ).toBe('http://localhost:3000/ogabassey/laptops/laptop');
    expect(
      getValidatedProductUrl(
        {
          ...product,
          canonical_url: 'http://localhost:3000/laptops/laptop',
        },
        'http://localhost:3000/ogabassey'
      )
    ).toBe('http://localhost:3000/ogabassey/laptops/laptop');
  });
});
