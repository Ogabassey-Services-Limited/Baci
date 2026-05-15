import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

// Mock api-auth
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

// Mock CSRF
const mockCheckCsrfProtection = vi.fn();
const mockGetMerchantBlogCacheIdentifiers = vi.fn();
const mockGetMerchantBlogPostCategories = vi.fn();
const mockGetMerchantBlogPostSlugs = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: (...args: unknown[]) =>
    mockGetMerchantBlogCacheIdentifiers(...args),
}));

vi.mock('@/lib/get-merchant-blog-post-categories', () => ({
  getMerchantBlogPostCategories: (...args: unknown[]) =>
    mockGetMerchantBlogPostCategories(...args),
}));

vi.mock('@/lib/get-merchant-blog-post-slugs', () => ({
  getMerchantBlogPostSlugs: (...args: unknown[]) =>
    mockGetMerchantBlogPostSlugs(...args),
}));

// Mock next/cache
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

// ---- Import handler AFTER mocks ----
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { POST } from './route';

// ---- Helpers ----

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/cache/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupAuth(hasAccess = true, hasPermissionValue = true) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: hasAccess ? { id: 'user-123' } : null,
    supabase: hasAccess ? {} : null,
    error: hasAccess ? null : 'Unauthorized',
  });

  mockGetUserAccess.mockResolvedValue(
    hasAccess
      ? {
          merchantId: MERCHANT_ID,
          role: 'owner',
        }
      : null
  );

  mockHasPermission.mockReturnValue(hasPermissionValue);
}

function setupCsrf(valid = true) {
  mockCheckCsrfProtection.mockResolvedValue({
    valid,
    response: valid ? null : { status: 403 },
  });
}

// ---- Tests ----

describe('POST /api/cache/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCsrf(true);
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    mockGetMerchantBlogPostCategories.mockResolvedValue(['reviews', 'laptops']);
    mockGetMerchantBlogPostSlugs.mockResolvedValue([
      'apple-studio-display-review',
      'airpods-max-2-2026',
    ]);
  });

  describe('CSRF protection', () => {
    it('returns 403 when CSRF check fails', async () => {
      const mockResponse = {
        status: 403,
        json: () => Promise.resolve({ error: 'CSRF validation failed' }),
      };
      setupCsrf(false);
      mockCheckCsrfProtection.mockResolvedValue({
        valid: false,
        response: mockResponse,
      });

      const res = await POST(makeRequest({ targets: ['products'] }));

      expect(res).toBe(mockResponse);
    });
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false);

      const res = await POST(makeRequest({ targets: ['products'] }));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant not found', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({
        user: { id: 'user-123' },
        supabase: {},
        error: null,
      });
      mockGetUserAccess.mockResolvedValue(null);

      const res = await POST(makeRequest({ targets: ['products'] }));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks settings edit permission', async () => {
      setupAuth(true, false);

      const res = await POST(makeRequest({ targets: ['products'] }));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        expect.anything(),
        'settings',
        'edit'
      );
    });
  });

  describe('validation', () => {
    it('returns 400 when targets array is empty', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: [] }));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid input');
      expect(json.details).toBeDefined();
    });

    it('returns 400 when targets is missing', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({}));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid input');
    });

    it('returns 400 when targets contains invalid value', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['invalid_target'] }));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid input');
    });

    it('accepts all valid target types', async () => {
      setupAuth(true, true);

      const validTargets = [
        'products',
        'categories',
        'merchant',
        'blog',
        'reviews',
        'features',
        'pages',
        'all',
      ];

      const res = await POST(makeRequest({ targets: validTargets }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('revalidation - specific targets', () => {
    it('revalidates products cache when products target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['products'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.revalidated).toContain('products');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'product-details',
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'category-page-data',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('revalidates categories cache when categories target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['categories'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('categories');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'category-page-data',
        'storefront-page'
      );
    });

    it('revalidates merchant cache when merchant target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['merchant'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('merchant');

      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('revalidates blog cache when blog target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['blog'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('blog');

      expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledWith(
        {},
        MERCHANT_ID
      );
      expect(mockGetMerchantBlogPostSlugs).toHaveBeenCalledWith(
        {},
        MERCHANT_ID
      );
      expect(mockGetMerchantBlogPostCategories).toHaveBeenCalledWith(
        {},
        MERCHANT_ID
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-reviews-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-laptops-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-reviews-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-laptops-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('test-store', 'apple-studio-display-review'),
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('test-store', 'airpods-max-2-2026'),
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('ogabassey.com', 'apple-studio-display-review'),
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('ogabassey.com', 'airpods-max-2-2026'),
        'merchant'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/test-store/blog');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-store/blog/apple-studio-display-review'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-store/blog/airpods-max-2-2026'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ogabassey.com/blog');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/ogabassey.com/blog/apple-studio-display-review'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/ogabassey.com/blog/airpods-max-2-2026'
      );
    });

    it('revalidates additional blog listing pages when the merchant has multiple pages of posts', async () => {
      setupAuth(true, true);
      mockGetMerchantBlogPostSlugs.mockResolvedValue([
        'apple-studio-display-review',
        'airpods-max-2-2026',
        'post-3',
        'post-4',
        'post-5',
        'post-6',
        'post-7',
        'post-8',
        'post-9',
        'post-10',
        'post-11',
        'post-12',
        'post-13',
      ]);

      const res = await POST(makeRequest({ targets: ['blog'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('blog');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-all-2',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-all-2',
        'merchant'
      );
    });

    it('skips blog revalidation when blog cache identifiers lookup fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        setupAuth(true, true);
        mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
          new Error('lookup failed')
        );

        const res = await POST(makeRequest({ targets: ['blog'] }));
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toBe('Cache purge failed for: blog');
        expect(json.revalidated).not.toContain('blog');
        expect(json.failedTargets).toEqual(['blog']);
        expect(mockRevalidateTag).not.toHaveBeenCalledWith(
          'blog-posts',
          'merchant'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to revalidate blog caches:',
          expect.objectContaining({
            merchantId: MERCHANT_ID,
            error: expect.any(Error),
          })
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('revalidates reviews cache when reviews target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['reviews'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('reviews');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `reviews-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `rating-stats-${MERCHANT_ID}`,
        'products'
      );
    });

    it('revalidates features cache when features target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['features'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('features');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `features-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('revalidates pages cache when pages target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['pages'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toContain('pages');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
    });
  });

  describe('revalidation - multiple targets', () => {
    it('revalidates multiple caches when multiple targets specified', async () => {
      setupAuth(true, true);

      const res = await POST(
        makeRequest({ targets: ['products', 'merchant'] })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.revalidated).toContain('products');
      expect(json.revalidated).toContain('merchant');
      expect(json.message).toContain('products');
      expect(json.message).toContain('merchant');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('does not revalidate tags for unspecified targets', async () => {
      setupAuth(true, true);

      await POST(makeRequest({ targets: ['products'] }));

      expect(mockRevalidateTag).not.toHaveBeenCalledWith(
        'merchants',
        'merchant'
      );
      expect(mockRevalidateTag).not.toHaveBeenCalledWith(
        'blog-posts',
        'merchant'
      );
      expect(mockRevalidateTag).not.toHaveBeenCalledWith(
        `reviews-${MERCHANT_ID}`,
        'products'
      );
    });
  });

  describe('revalidation - all target', () => {
    it('revalidates all caches when all target specified', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['all'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.revalidated).toHaveLength(7);
      expect(json.revalidated).toEqual(
        expect.arrayContaining([
          'products',
          'categories',
          'merchant',
          'blog',
          'reviews',
          'features',
          'pages',
        ])
      );

      // Verify all tags were revalidated
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'product-details',
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'category-page-data',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `reviews-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `features-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('revalidates all when all is combined with specific targets', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['all', 'products'] }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revalidated).toHaveLength(7);

      // Should have revalidated all categories
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-store-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
    });
  });

  describe('dashboard revalidation', () => {
    it('revalidates dashboard cache for products and merchant targets', async () => {
      setupAuth(true, true);

      // Only products and merchant trigger dashboard revalidation
      for (const target of ['products', 'merchant']) {
        mockRevalidateTag.mockClear();
        await POST(makeRequest({ targets: [target] }));

        expect(mockRevalidateTag).toHaveBeenCalledWith(
          `dashboard-${MERCHANT_ID}`,
          'merchant'
        );
      }
    });

    it('does not revalidate dashboard for other targets', async () => {
      setupAuth(true, true);

      for (const target of [
        'categories',
        'blog',
        'reviews',
        'features',
        'pages',
      ]) {
        mockRevalidateTag.mockClear();
        await POST(makeRequest({ targets: [target] }));

        expect(mockRevalidateTag).not.toHaveBeenCalledWith(
          `dashboard-${MERCHANT_ID}`,
          'merchant'
        );
      }
    });
  });

  describe('response format', () => {
    it('returns success with revalidated list and message', async () => {
      setupAuth(true, true);

      const res = await POST(
        makeRequest({ targets: ['products', 'merchant'] })
      );
      const json = await res.json();

      expect(json).toEqual({
        success: true,
        failedTargets: [],
        revalidated: expect.arrayContaining(['products', 'merchant']),
        message: expect.stringContaining('Cache purged for'),
      });
      expect(json.message).toContain('products');
      expect(json.message).toContain('merchant');
    });

    it('returns correct message format for single target', async () => {
      setupAuth(true, true);

      const res = await POST(makeRequest({ targets: ['products'] }));
      const json = await res.json();

      expect(json.message).toBe('Cache purged for: products');
    });
  });
});
