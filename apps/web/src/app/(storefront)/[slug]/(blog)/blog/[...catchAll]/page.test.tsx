import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
});
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockGetCachedBlogPost = vi.fn();
const mockGetCachedMerchant = vi.fn();
const mockGetCachedMerchantByDomain = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();
const mockCookies = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: (...args: unknown[]) => mockGetCachedBlogPost(...args),
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedMerchantByDomain: (...args: unknown[]) =>
    mockGetCachedMerchantByDomain(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

vi.mock(
  '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-content',
  () => ({
    buildCanonicalBlogPostUrl: (
      merchant: { custom_domain?: string; slug: string },
      postSlug: string
    ) =>
      merchant.custom_domain
        ? `https://${merchant.custom_domain}/blog/${postSlug}`
        : `https://${merchant.slug}.usebaci.com/blog/${postSlug}`,
  })
);

import BlogCatchAllPage from './page';

describe('storefront blog catch-all route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCookies.mockResolvedValue({});
    mockCreateClient.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockImplementation((_column: string, _value: string) => ({
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      limit: mockLimit,
    }));
    mockLimit.mockResolvedValue({ data: [] });
    mockMaybeSingle.mockResolvedValue({ data: null });
  });

  it('redirects dated blog permalinks to the canonical blog post URL', async () => {
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
      BlogCatchAllPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: [
            '2025',
            '04',
            '10',
            'is-the-redmi-a5-the-best-budget-phone-of-2025',
          ],
        }),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/is-the-redmi-a5-the-best-budget-phone-of-2025'
    );

    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'is-the-redmi-a5-the-best-budget-phone-of-2025',
      false
    );
    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
  });

  it('returns notFound when a dated blog permalink no longer resolves', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);

    await expect(
      BlogCatchAllPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['2025', '04', '10', 'missing-post'],
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('keeps redirecting category-prefixed legacy blog URLs to canonical public URL', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { slug: 'snapdragon-x2-series-on-windows' },
    });

    await expect(
      BlogCatchAllPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'snapdragon-x2-series-on-windows'],
        }),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/snapdragon-x2-series-on-windows'
    );

    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetCachedMerchantByDomain).toHaveBeenCalledWith('ogabassey.com');
  });

  it('redirects fuzzy slug matches with a temporary (307) redirect to allow re-mapping', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    // First exact-match query returns no data, fuzzy fallback finds the post
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'snapdragon-x2-series-on-windows' }],
    });

    await expect(
      BlogCatchAllPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'snapdragon_x2_series_on_windows'],
        }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://ogabassey.usebaci.com/blog/snapdragon-x2-series-on-windows'
    );
    // Must NOT use permanentRedirect — a fuzzy match is best-effort and the
    // 308 would be cached indefinitely by browsers, blocking future slugs.
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it('falls through to notFound when neither exact nor fuzzy lookup resolves', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    // Exact lookup returns nothing
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    // Fuzzy lookup returns an unrelated post
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'some-unrelated-post' }],
    });

    await expect(
      BlogCatchAllPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'nonexistent-post-slug'],
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
