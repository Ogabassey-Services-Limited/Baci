import { describe, expect, it } from 'vitest';
import {
  getStaticSitemapEntries,
  getTrustPolicySitemapEntries,
} from './storefront-static-sitemap-entries';

describe('storefront static sitemap entries', () => {
  it('fails closed when the home page lacks published indexability facts', () => {
    expect(
      getStaticSitemapEntries({
        merchant: { slug: 'zorvexa', is_published: null },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([]);
  });

  it('includes only meaningful trust policy routes', () => {
    expect(
      getTrustPolicySitemapEntries({
        merchant: {
          slug: 'zorvexa',
          trust_profile: {
            return_policy: { summary: 'Returns within 14 days' },
          },
        },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([
      expect.objectContaining({ url: 'https://zorvexa.usebaci.com/returns' }),
    ]);
  });
});
