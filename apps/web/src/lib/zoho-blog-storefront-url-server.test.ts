import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildStorefrontBlogPostUrl } from './zoho-blog-storefront-url-server';

const context = {
  canonicalMerchantSlug: 'ogabassey',
  identifiers: ['ogabassey', 'ogabassey.com'],
};

describe('buildStorefrontBlogPostUrl', () => {
  it('uses the merchant custom domain for public blog URLs', () => {
    expect(
      buildStorefrontBlogPostUrl({
        context,
        publicBaseUrl: 'https://usebaci.com',
        slug: 'infinix-hot-70-launch',
      })
    ).toBe('https://ogabassey.com/blog/infinix-hot-70-launch');
  });

  it('uses the canonical merchant slug when no custom domain is available', () => {
    expect(
      buildStorefrontBlogPostUrl({
        context: {
          canonicalMerchantSlug: 'ogabassey',
          identifiers: ['ogabassey'],
        },
        publicBaseUrl: 'https://usebaci.com',
        slug: 'infinix-hot-70-launch',
      })
    ).toBe('https://usebaci.com/ogabassey/blog/infinix-hot-70-launch');
  });

  it('falls back to the public base URL when no canonical slug exists', () => {
    expect(
      buildStorefrontBlogPostUrl({
        context: {
          canonicalMerchantSlug: null,
          identifiers: [],
        },
        publicBaseUrl: 'https://usebaci.com',
        slug: 'infinix-hot-70-launch',
      })
    ).toBe('https://usebaci.com/blog/infinix-hot-70-launch');
  });

  it('ignores malformed dotted identifiers instead of treating them as domains', () => {
    expect(
      buildStorefrontBlogPostUrl({
        context: {
          canonicalMerchantSlug: 'ogabassey',
          identifiers: ['ogabassey', 'bad/domain.com', 'bad..domain'],
        },
        publicBaseUrl: 'https://usebaci.com',
        slug: 'infinix-hot-70-launch',
      })
    ).toBe('https://usebaci.com/ogabassey/blog/infinix-hot-70-launch');
  });
});
