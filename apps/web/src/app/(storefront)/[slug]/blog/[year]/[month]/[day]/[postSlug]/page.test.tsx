import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockGetCachedBlogPost = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: (...args: unknown[]) => mockGetCachedBlogPost(...args),
}));

vi.mock('../../[postSlug]/blog-post-content', () => ({
  buildCanonicalBlogPostUrl: (
    merchant: { custom_domain?: string; slug: string },
    postSlug: string
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}/blog/${postSlug}`
      : `https://${merchant.slug}.usebaci.com/blog/${postSlug}`,
}));

import DatedBlogPostRedirectPage from './page';

describe('dated storefront blog permalink route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects dated permalinks to the canonical blog post URL', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      merchant: {
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      post: {
        slug: 'is-the-redmi-a5-the-best-budget-phone-of-2025',
      },
    });

    await expect(
      DatedBlogPostRedirectPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          year: '2025',
          month: '04',
          day: '10',
          postSlug: 'is-the-redmi-a5-the-best-budget-phone-of-2025',
        }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://ogabassey.com/blog/is-the-redmi-a5-the-best-budget-phone-of-2025'
    );

    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'is-the-redmi-a5-the-best-budget-phone-of-2025',
      false
    );
  });

  it('returns notFound when the dated permalink does not map to a live post', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);

    await expect(
      DatedBlogPostRedirectPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          year: '2025',
          month: '04',
          day: '10',
          postSlug: 'missing-post',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });
});
