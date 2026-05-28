import { NextRequest } from 'next/server';
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
const mockGetBlogPostRedirect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();
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

vi.mock('@/lib/blog-post-redirects', () => ({
  getBlogPostRedirect: (...args: unknown[]) => mockGetBlogPostRedirect(...args),
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

import { resolveBlogCatchAllRoute } from './blog-catch-all-resolution';
import { GET, HEAD } from './route';

describe('storefront blog catch-all route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCookies.mockResolvedValue({});
    mockCreateClient.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockImplementation((_column: string, _value: string) => ({
      eq: mockEq,
      not: mockNot,
      maybeSingle: mockMaybeSingle,
      limit: mockLimit,
    }));
    mockNot.mockImplementation(() => ({
      eq: mockEq,
      not: mockNot,
      maybeSingle: mockMaybeSingle,
      limit: mockLimit,
    }));
    mockLimit.mockResolvedValue({ data: [] });
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockGetBlogPostRedirect.mockResolvedValue(null);
  });

  it('serves legacy redirects from a route handler without a React shell', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { slug: 'snapdragon-x2-series-on-windows' },
    });

    const response = await GET(
      new NextRequest(
        'https://ogabassey.com/blog/laptops/snapdragon-x2-series-on-windows'
      ),
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'snapdragon-x2-series-on-windows'],
        }),
      }
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://ogabassey.com/blog/snapdragon-x2-series-on-windows'
    );
    expect(response.headers.get('content-type')).toBeNull();
  });

  it('serves unresolved archive paths as direct noindex 404 responses', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'some-unrelated-post' }],
    });

    const response = await GET(
      new NextRequest('https://ogabassey.com/blog/2025/01/15'),
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['2025', '01', '15'],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.text()).resolves.toBe('Not Found');
  });

  it('preserves direct 404 status for HEAD requests', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({ data: [] });

    const response = await HEAD(
      new NextRequest('https://ogabassey.com/blog/tag/iphone', {
        method: 'HEAD',
      }),
      {
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['tag', 'iphone'],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    await expect(response.text()).resolves.toBe('');
  });

  it('redirects dated blog permalinks', async () => {
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
      resolveBlogCatchAllRoute({
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
      resolveBlogCatchAllRoute({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['2025', '04', '10', 'missing-post'],
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('rejects WordPress dump probes before merchant or database lookup', async () => {
    await expect(
      resolveBlogCatchAllRoute({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['wp-content', 'uploads', 'database.sql'],
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
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
      resolveBlogCatchAllRoute({
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
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('throws exact lookup errors instead of reporting a missing post', async () => {
    const lookupError = new Error('blog exact lookup failed');
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: lookupError,
    });

    await expect(
      resolveBlogCatchAllRoute({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'snapdragon-x2-series-on-windows'],
        }),
      })
    ).rejects.toThrow(lookupError);

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
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
      resolveBlogCatchAllRoute({
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
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('permanently redirects retired duplicate slugs to their canonical posts', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockGetBlogPostRedirect.mockResolvedValueOnce({
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      targetSlug: 'canonical-post',
    });

    await expect(
      resolveBlogCatchAllRoute({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['old-category', 'retired-post'],
        }),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/canonical-post'
    );

    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'retired-post'
    );
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('throws fuzzy lookup errors instead of reporting a missing post', async () => {
    const lookupError = new Error('blog fuzzy lookup failed');
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: lookupError,
    });

    await expect(
      resolveBlogCatchAllRoute({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['laptops', 'snapdragon_x2_series_on_windows'],
        }),
      })
    ).rejects.toThrow(lookupError);

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
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
      resolveBlogCatchAllRoute({
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
