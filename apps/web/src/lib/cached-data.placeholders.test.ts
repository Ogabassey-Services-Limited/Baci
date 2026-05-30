import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedBlogListing,
  getCachedBlogPost,
  getCachedCategoryPageData,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProduct,
  getCachedProductLcpHint,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
  MOCK_BUILD_TIME_BLOG_POST,
  MOCK_BUILD_TIME_CATEGORY_PAGE_DATA,
  MOCK_BUILD_TIME_MERCHANT,
  MOCK_BUILD_TIME_PRODUCT,
  MOCK_BUILD_TIME_PRODUCT_LCP_HINT,
} from '@/lib/cached-data';

// Mock dependencies that might be loaded, but ensure no DB calls are triggered
vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('react', () => ({ cache: vi.fn((fn) => fn) }));

describe('cached-data compile-time dynamic route placeholders', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getCachedMerchant', () => {
    it('returns MOCK_BUILD_TIME_MERCHANT for dynamic route placeholders', async () => {
      const result = await getCachedMerchant('[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_MERCHANT);
    });
  });

  describe('getCachedMerchantByDomain', () => {
    it('returns MOCK_BUILD_TIME_MERCHANT for dynamic domain placeholders', async () => {
      const result = await getCachedMerchantByDomain('[domain]');
      expect(result).toEqual(MOCK_BUILD_TIME_MERCHANT);
    });
  });

  describe('getMerchantByIdentifier', () => {
    it('returns MOCK_BUILD_TIME_MERCHANT for dynamic identifier placeholders', async () => {
      const result = await getMerchantByIdentifier('[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_MERCHANT);
    });
  });

  describe('getCachedProductLcpHint', () => {
    it('returns MOCK_BUILD_TIME_PRODUCT_LCP_HINT for dynamic product slug placeholders', async () => {
      const result = await getCachedProductLcpHint(
        'merchant-123',
        '[productSlug]'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT_LCP_HINT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT_LCP_HINT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProductLcpHint('[slug]', 'my-product');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT_LCP_HINT);
    });
  });

  describe('getCachedProduct', () => {
    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic product slug placeholders', async () => {
      const result = await getCachedProduct('merchant-123', '[productSlug]');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProduct('[slug]', 'my-product');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });
  });

  describe('getCachedProductWithDetails', () => {
    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic product slug placeholders', async () => {
      const result = await getCachedProductWithDetails(
        'merchant-123',
        '[productSlug]'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProductWithDetails('[slug]', 'my-product');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });
  });

  describe('getCachedCategoryPageData', () => {
    it('returns MOCK_BUILD_TIME_CATEGORY_PAGE_DATA for dynamic category placeholders', async () => {
      const result = await getCachedCategoryPageData(
        'merchant-123',
        '[category]',
        'storefront'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_CATEGORY_PAGE_DATA);
    });

    it('returns MOCK_BUILD_TIME_CATEGORY_PAGE_DATA for the mock build merchant id', async () => {
      const result = await getCachedCategoryPageData(
        MOCK_BUILD_TIME_MERCHANT.id,
        'electronics',
        '[slug]'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_CATEGORY_PAGE_DATA);
    });
  });

  describe('getCachedBlogPost', () => {
    it('returns MOCK_BUILD_TIME_BLOG_POST for dynamic blog post slug placeholders', async () => {
      const result = await getCachedBlogPost('merchant-123', '[postSlug]');
      expect(result).toEqual(MOCK_BUILD_TIME_BLOG_POST);
    });

    it('returns MOCK_BUILD_TIME_BLOG_POST for dynamic merchant ID placeholders', async () => {
      const result = await getCachedBlogPost('[slug]', 'my-post');
      expect(result).toEqual(MOCK_BUILD_TIME_BLOG_POST);
    });
  });

  describe('getCachedBlogListing', () => {
    it('returns stable mock blog listing data for dynamic merchant placeholders', async () => {
      const result = await getCachedBlogListing('[slug]', {
        page: 2,
        searchQuery: 'console',
      });

      expect(result).toMatchObject({
        merchant: {
          id: MOCK_BUILD_TIME_MERCHANT.id,
          slug: MOCK_BUILD_TIME_MERCHANT.slug,
        },
        posts: [],
        totalPosts: 0,
        categories: [],
        currentPage: 2,
        totalPages: 0,
        searchQuery: 'console',
      });
    });
  });
});

describe('cached-data runtime dynamic route placeholders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not return mock merchant data for literal placeholder requests outside the build phase', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');

    await expect(getMerchantByIdentifier('[slug]')).resolves.toBeNull();
  });
});
