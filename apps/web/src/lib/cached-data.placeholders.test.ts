import { describe, expect, it, vi } from 'vitest';
import {
  getCachedBlogPost,
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProduct,
  getCachedProductLcpHint,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
  MOCK_BUILD_TIME_BLOG_POST,
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
        '[productSlug]',
        'merchant-123'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT_LCP_HINT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT_LCP_HINT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProductLcpHint('my-product', '[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT_LCP_HINT);
    });
  });

  describe('getCachedProduct', () => {
    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic product slug placeholders', async () => {
      const result = await getCachedProduct('[productSlug]', 'merchant-123');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProduct('my-product', '[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });
  });

  describe('getCachedProductWithDetails', () => {
    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic product slug placeholders', async () => {
      const result = await getCachedProductWithDetails(
        '[productSlug]',
        'merchant-123'
      );
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });

    it('returns MOCK_BUILD_TIME_PRODUCT for dynamic merchant ID placeholders', async () => {
      const result = await getCachedProductWithDetails('my-product', '[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_PRODUCT);
    });
  });

  describe('getCachedBlogPost', () => {
    it('returns MOCK_BUILD_TIME_BLOG_POST for dynamic blog post slug placeholders', async () => {
      const result = await getCachedBlogPost('[postSlug]', 'merchant-123');
      expect(result).toEqual(MOCK_BUILD_TIME_BLOG_POST);
    });

    it('returns MOCK_BUILD_TIME_BLOG_POST for dynamic merchant ID placeholders', async () => {
      const result = await getCachedBlogPost('my-post', '[slug]');
      expect(result).toEqual(MOCK_BUILD_TIME_BLOG_POST);
    });
  });
});
