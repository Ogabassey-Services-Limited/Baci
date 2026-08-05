import { describe, expect, it } from 'vitest';
import { getStaticSitemapEntries } from './get-static-sitemap-entries';

describe('getStaticSitemapEntries', () => {
  it('fails closed for an unpublished storefront', () => {
    expect(
      getStaticSitemapEntries({
        merchant: { slug: 'zorvexa', is_published: false },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([]);
  });

  it('returns the indexable home and FAQ URLs', () => {
    expect(
      getStaticSitemapEntries({
        merchant: {
          slug: 'zorvexa',
          is_published: true,
          business_name: 'Zorvexa',
        },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://zorvexa.usebaci.com' }),
        expect.objectContaining({ url: 'https://zorvexa.usebaci.com/faq' }),
      ])
    );
  });
});
