import { describe, expect, it } from 'vitest';
import { isStorefrontStaticSitemapEligible } from './is-storefront-static-sitemap-eligible';

describe('isStorefrontStaticSitemapEligible', () => {
  it('requires an explicitly published, indexable storefront', () => {
    expect(
      isStorefrontStaticSitemapEligible(
        { slug: 'zorvexa', is_published: false, business_name: 'Zorvexa' },
        'https://zorvexa.usebaci.com'
      )
    ).toBe(false);
  });
});
