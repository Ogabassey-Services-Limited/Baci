import { describe, expect, it } from 'vitest';
import { getStaticSitemapEntries } from './sitemap-data';

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
        merchant: { is_published: true },
        storeUrl: 'https://zorvexa.usebaci.com',
      } as never)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://zorvexa.usebaci.com' }),
      ])
    );
  });
});
