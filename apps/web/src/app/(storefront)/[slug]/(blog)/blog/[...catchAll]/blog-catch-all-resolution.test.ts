import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { resolveBlogCatchAllOutcome } from './blog-catch-all-resolution';

describe('resolveBlogCatchAllOutcome slug safety gate', () => {
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

  it('returns notFound for over-encoded bot segments before any cached or database lookup', async () => {
    let overEncodedSegment = 'some phrase';
    for (let i = 0; i < 10; i++) {
      overEncodedSegment = encodeURIComponent(overEncodedSegment);
    }

    await expect(
      resolveBlogCatchAllOutcome({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['author', overEncodedSegment],
        }),
      })
    ).resolves.toEqual({ type: 'notFound' });

    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockGetCachedMerchant).not.toHaveBeenCalled();
    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns notFound for extremely long segments before any cached or database lookup', async () => {
    await expect(
      resolveBlogCatchAllOutcome({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['a'.repeat(4000)],
        }),
      })
    ).resolves.toEqual({ type: 'notFound' });

    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockGetCachedMerchant).not.toHaveBeenCalled();
    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('does not reject a safe final slug carrying a long tracking query tail', async () => {
    // The guard checks the pre-`?` portion of the last segment to mirror the
    // downstream `cleanPostSlug = postSlug.split('?')[0]`, so a valid slug with
    // a long `?utm=…` tail must still reach the lookups (not be 404'd).
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });

    await expect(
      resolveBlogCatchAllOutcome({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: [`the-iphone-15-what-we-know?${'utm=x&'.repeat(500)}`],
        }),
      })
    ).resolves.toEqual({ type: 'notFound' });

    // Gate passed → the lookups ran on the stripped slug.
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'the-iphone-15-what-we-know'
    );
  });

  it('rejects a final segment whose pre-? slug portion is over-long', async () => {
    await expect(
      resolveBlogCatchAllOutcome({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: [`${'a'.repeat(4000)}?utm=x`],
        }),
      })
    ).resolves.toEqual({ type: 'notFound' });

    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('falls through to notFound for safe unknown slugs only after the lookups run', async () => {
    mockGetCachedMerchantByDomain.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'some-unrelated-post' }],
    });

    await expect(
      resolveBlogCatchAllOutcome({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          catchAll: ['author', 'unknown-author'],
        }),
      })
    ).resolves.toEqual({ type: 'notFound' });

    expect(mockGetCachedMerchantByDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'unknown-author'
    );
  });
});
