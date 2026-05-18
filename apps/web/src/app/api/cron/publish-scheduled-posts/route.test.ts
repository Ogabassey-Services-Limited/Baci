import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const mockGetMerchantBlogCacheIdentifiers = vi.fn();
const mockRevalidateBlogPosts = vi.fn();
const merchantId = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const managedFeaturedImageUrl = `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/storage/v1/object/public/media/${merchantId}/blog/cover.png`;
const managedLandscapeVariantUrl = `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/storage/v1/object/public/media/${merchantId}/blog/upload-1/landscape_16x9.webp`;

const createServiceClientMock = () => {
  const mock = {
    eq: vi.fn(),
    from: vi.fn(),
    in: vi.fn(),
    lte: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);

  return mock;
};

const mockSupabase = createServiceClientMock();

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: (...args: unknown[]) =>
    mockGetMerchantBlogCacheIdentifiers(...args),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateBlogPosts: (...args: unknown[]) => mockRevalidateBlogPosts(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}));

import { POST } from './route';

describe('POST /api/cron/publish-scheduled-posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createServiceClientMock());
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secrex',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('publishes scheduled posts and revalidates all merchant blog identifiers', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
        {
          id: 'post-2',
          slug: 'macbook-air-m4-review',
          merchant_id: 'merchant-1',
          category: 'laptops',
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [
          {
            merchant_id: 'merchant-1',
            blog_discover_image_validation_enabled: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 13 }, () => ({
          merchant_id: 'merchant-1',
        })),
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledWith(
      mockSupabase,
      'merchant-1'
    );
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledTimes(1);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
      listingCategories: ['reviews', 'laptops'],
      listingPages: [1, 2],
      postSlugs: ['apple-studio-display-review', 'macbook-air-m4-review'],
    });
    expect(mockRevalidateBlogPosts).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and records failed merchants when merchant cache identifier lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
        {
          id: 'post-2',
          slug: 'macbook-air-m4-review',
          merchant_id: 'merchant-2',
          category: 'laptops',
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [
          {
            merchant_id: 'merchant-1',
            blog_discover_image_validation_enabled: false,
          },
          {
            merchant_id: 'merchant-2',
            blog_discover_image_validation_enabled: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ merchant_id: 'merchant-1' }, { merchant_id: 'merchant-2' }],
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        identifiers: ['merchant-two'],
        canonicalMerchantSlug: 'merchant-two',
      });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      'Failed to revalidate blog caches for some merchants'
    );
    expect(json.failedMerchants).toEqual(['merchant-1']);
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledTimes(2);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledTimes(1);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['merchant-two'],
      canonicalMerchantSlug: 'merchant-two',
      listingCategories: ['laptops'],
      listingPages: [1],
      postSlugs: ['macbook-air-m4-review'],
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Cron Error: Revalidation failed for merchant %s:',
      'merchant-1',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 before publishing when published blog counts cannot be loaded', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [
          {
            merchant_id: 'merchant-1',
            blog_discover_image_validation_enabled: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'count failed' },
      });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to load published blog counts');
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('returns 500 before publishing when blog feature settings cannot be loaded', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
      ],
      error: null,
    });
    mockSupabase.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'feature settings failed' },
    });

    try {
      const response = await POST(
        new Request('http://localhost/api/cron/publish-scheduled-posts', {
          method: 'POST',
          headers: {
            'x-cron-secret': 'test-secret',
          },
        })
      );
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to load blog feature settings');
      expect(mockSupabase.update).not.toHaveBeenCalled();
      expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cron Error: Failed to load blog Discover validation flags:',
        { message: 'feature settings failed' }
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('skips invalid scheduled rows when validation is enabled and revalidates eligible rows only', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-ready',
          slug: 'ready-post',
          merchant_id: merchantId,
          category: 'guides',
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeVariantUrl,
          },
        },
        {
          id: 'post-invalid',
          slug: 'invalid-post',
          merchant_id: merchantId,
          category: 'guides',
          featured_image_url: null,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [
          {
            merchant_id: merchantId,
            blog_discover_image_validation_enabled: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store'],
      canonicalMerchantSlug: 'test-store',
    });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.published).toEqual(['post-ready']);
    expect(json.skipped).toEqual([
      expect.objectContaining({
        id: 'post-invalid',
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      }),
    ]);
    expect(mockSupabase.in).toHaveBeenLastCalledWith('id', ['post-ready']);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        postSlugs: ['ready-post'],
      })
    );
  });

  it('logs readiness warnings but publishes invalid rows when validation is disabled', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-invalid',
          slug: 'invalid-post',
          merchant_id: merchantId,
          category: 'guides',
          featured_image_url: null,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [
          {
            merchant_id: merchantId,
            blog_discover_image_validation_enabled: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store'],
      canonicalMerchantSlug: 'test-store',
    });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.published).toEqual(['post-invalid']);
    expect(json.warnings).toEqual([
      expect.objectContaining({
        id: 'post-invalid',
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      }),
    ]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Cron Warning: Scheduled blog post is not Discover image ready',
      expect.objectContaining({
        id: 'post-invalid',
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      })
    );
    expect(mockSupabase.in).toHaveBeenLastCalledWith('id', ['post-invalid']);
    consoleWarnSpy.mockRestore();
  });

  it('does not batch update when validation is enabled and no scheduled rows are eligible', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-invalid',
          slug: 'invalid-post',
          merchant_id: merchantId,
          category: 'guides',
          featured_image_url: null,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
      ],
      error: null,
    });
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        {
          merchant_id: merchantId,
          blog_discover_image_validation_enabled: true,
        },
      ],
      error: null,
    });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.published).toEqual([]);
    expect(json.skipped).toEqual([
      expect.objectContaining({
        id: 'post-invalid',
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      }),
    ]);
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });
});
