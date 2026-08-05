import { describe, expect, it } from 'vitest';
import { getTrustPolicySitemapEntries } from './get-trust-policy-sitemap-entries';

describe('getTrustPolicySitemapEntries', () => {
  it('does not expose trust URLs for an unpublished storefront', () => {
    expect(
      getTrustPolicySitemapEntries({
        merchant: {
          slug: 'zorvexa',
          is_published: false,
          trust_profile: {
            return_policy: { summary: 'Returns within 14 days' },
          },
        },
        storeUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual([]);
  });

  it('returns only publishable trust policy URLs', () => {
    expect(
      getTrustPolicySitemapEntries({
        merchant: {
          slug: 'zorvexa',
          is_published: true,
          business_name: 'Zorvexa',
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
