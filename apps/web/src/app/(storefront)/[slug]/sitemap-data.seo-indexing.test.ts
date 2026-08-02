import { describe, expect, it } from 'vitest';
import {
  getProductSitemapEntries,
  getStaticSitemapEntries,
} from './sitemap-data';

describe('storefront sitemap SEO indexing', () => {
  it('omits static URLs for an unpublished merchant', () => {
    expect(
      getStaticSitemapEntries({
        merchant: { is_published: false },
        storeUrl: 'https://zorvexa.usebaci.com',
      } as never)
    ).toEqual([]);
  });

  it('keeps the published home sitemap entry without product prerequisites', () => {
    expect(
      getStaticSitemapEntries({
        merchant: { is_published: true, slug: 'zorvexa' },
        storeUrl: 'https://zorvexa.usebaci.com',
      } as never)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://zorvexa.usebaci.com' }),
      ])
    );
  });

  it('omits a published active product when its persisted name is blank', async () => {
    const rows = [
      {
        id: 'product-1',
        name: ' ',
        slug: 'fallback-slug',
        category: null,
        canonical_url: null,
        images: [],
        updated_at: null,
        categories: null,
      },
    ];
    const query = {
      eq: () => query,
      order: () => ({ range: () => ({ data: rows, error: null }) }),
    };

    await expect(
      getProductSitemapEntries({
        merchant: { id: 'merchant-1', slug: 'zorvexa', is_published: true },
        storeUrl: 'https://zorvexa.usebaci.com',
        supabase: { from: () => ({ select: () => query }) },
      } as never)
    ).resolves.toEqual([]);
  });
});
