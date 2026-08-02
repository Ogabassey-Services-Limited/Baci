import { describe, expect, it } from 'vitest';
import { buildProductSitemapEntry } from './build-product-sitemap-entry';

describe('buildProductSitemapEntry', () => {
  it('preserves the canonical category path and valid image URLs', () => {
    expect(
      buildProductSitemapEntry({
        product: {
          id: 'product-1',
          slug: 'linen-shirt',
          category: 'Fashion',
          canonical_url: null,
          images: [
            'https://cdn.example.com/linen-shirt.jpg',
            { url: 'not-an-absolute-url' },
          ],
          updated_at: '2026-08-01T00:00:00.000Z',
          categories: { slug: 'fashion' },
        },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual({
      url: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
      lastModified: new Date('2026-08-01T00:00:00.000Z'),
      changeFrequency: 'weekly',
      priority: 0.8,
      images: ['https://cdn.example.com/linen-shirt.jpg'],
    });
  });
});
