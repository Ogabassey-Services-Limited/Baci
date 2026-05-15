import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

import { getBlogCacheTag } from '@/lib/blog-cache-tags';
// ---- Import functions AFTER mocks ----
import {
  revalidateBlogPosts,
  revalidateCategories,
  revalidateDomains,
  revalidateFeatures,
  revalidateMerchant,
  revalidateMerchantFeed,
  revalidatePageConfig,
  revalidateProducts,
  revalidateReviews,
} from './cache-revalidation';

// ---- Helpers ----

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

// ---- Tests ----

describe('cache-revalidation utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('revalidateProducts', () => {
    it('revalidates products cache with merchant ID', () => {
      revalidateProducts(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `storefront-products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
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
        `product-index-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'product-legacy-redirect',
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-feed-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(9);
    });

    it('revalidates specific product when slug provided', () => {
      const productSlug = 'test-product';

      revalidateProducts(MERCHANT_ID, productSlug);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `storefront-products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `product-${MERCHANT_ID}-${productSlug}`,
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
        `product-index-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'product-legacy-redirect',
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-feed-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(10);
    });

    it('handles empty slug gracefully', () => {
      revalidateProducts(MERCHANT_ID, '');

      // Should not call specific product tag when slug is empty
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `storefront-products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(9);
    });
  });

  describe('revalidateCategories', () => {
    it('revalidates categories cache with merchant ID', () => {
      revalidateCategories(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'navigation-categories',
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'category-page-data',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(3);
    });

    it('revalidates specific category when slug provided', () => {
      const categorySlug = 'test-category';

      revalidateCategories(MERCHANT_ID, categorySlug);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'navigation-categories',
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `category-${MERCHANT_ID}-${categorySlug}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'category-page-data',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(4);
    });

    it('handles empty slug gracefully', () => {
      revalidateCategories(MERCHANT_ID, '');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(3);
    });
  });

  describe('revalidateMerchant', () => {
    it('revalidates merchant cache with merchant ID', () => {
      revalidateMerchant(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(3);
    });

    it('revalidates specific merchant when slug provided', () => {
      const merchantSlug = 'test-store';

      revalidateMerchant(MERCHANT_ID, merchantSlug);

      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-${merchantSlug}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(4);
    });

    it('handles empty slug gracefully', () => {
      revalidateMerchant(MERCHANT_ID, '');

      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-id-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(3);
    });
  });

  describe('revalidateBlogPosts', () => {
    it('revalidates blog posts cache', () => {
      revalidateBlogPosts({
        identifiers: ['test-merchant', 'OGABASSEY.COM', 'test-merchant'],
        canonicalMerchantSlug: 'test-merchant',
        listingCategories: ['Reviews'],
        listingPages: [1, 2, 2],
        postSlugs: ['test-post', 'Test-Post'],
      });

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-merchant-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-merchant-all-2',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-merchant-Reviews-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('test-merchant', 'test-post'),
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-ogabassey.com-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('OGABASSEY.COM', 'test-post'),
        'merchant'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/test-merchant/blog');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-merchant/blog/test-post'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-merchant/blog/test-post/opengraph-image'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/ogabassey.com/blog');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/ogabassey.com/blog/test-post'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/ogabassey.com/blog/test-post/opengraph-image'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/api/blog/feed/test-merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-rss-feed',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith('blog-posts', 'merchant');
    });

    it('supports the legacy identifier + slug signature', () => {
      revalidateBlogPosts('test-merchant', 'test-post');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'blog-list-test-merchant-all-1',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag('test-merchant', 'test-post'),
        'merchant'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/test-merchant/blog');
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-merchant/blog/test-post'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/test-merchant/blog/test-post/opengraph-image'
      );
      expect(mockRevalidatePath).not.toHaveBeenCalledWith(
        '/api/blog/feed/test-merchant'
      );
    });

    it('handles empty identifiers and slugs gracefully', () => {
      revalidateBlogPosts({
        identifiers: [' ', null, undefined],
        postSlugs: ['', null, undefined],
      });

      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('uses explicit canonicalMerchantSlug for feed invalidation instead of identifier order', () => {
      revalidateBlogPosts({
        identifiers: ['shop.example.com', 'ogabassey'],
        canonicalMerchantSlug: 'ogabassey',
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        '/api/blog/feed/ogabassey'
      );
      expect(mockRevalidatePath).not.toHaveBeenCalledWith(
        '/api/blog/feed/shop.example.com'
      );
    });

    it('skips unsafe canonicalMerchantSlug values for feed path revalidation', () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      revalidateBlogPosts({
        identifiers: ['test-merchant'],
        canonicalMerchantSlug: '../evil/path',
      });

      expect(mockRevalidatePath).not.toHaveBeenCalledWith(
        '/api/blog/feed/../evil/path'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Skipped blog feed path revalidation for invalid slug',
        {
          canonicalMerchantSlug: '../evil/path',
        }
      );

      warnSpy.mockRestore();
    });

    it('works with a merchant identifier as a single path target', () => {
      revalidateBlogPosts(MERCHANT_ID, 'my-blog-post');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `blog-list-${MERCHANT_ID}-all-1`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        getBlogCacheTag(MERCHANT_ID, 'my-blog-post'),
        'merchant'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/${MERCHANT_ID}/blog`);
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/${MERCHANT_ID}/blog/my-blog-post`
      );
    });
  });

  describe('revalidateReviews', () => {
    it('revalidates reviews cache with product ID', () => {
      const productId = 'product-123';

      revalidateReviews(productId);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `reviews-${productId}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `rating-stats-${productId}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    });

    it('works with different product IDs', () => {
      const productId1 = 'product-456';
      const productId2 = 'product-789';

      revalidateReviews(productId1);
      mockRevalidateTag.mockClear();
      revalidateReviews(productId2);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `reviews-${productId2}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `rating-stats-${productId2}`,
        'products'
      );
    });
  });

  describe('revalidateFeatures', () => {
    it('revalidates features cache with merchant ID', () => {
      revalidateFeatures(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `features-${MERCHANT_ID}`,
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('works with different merchant IDs', () => {
      const merchantId1 = 'merchant-111';
      const merchantId2 = 'merchant-222';

      revalidateFeatures(merchantId1);
      mockRevalidateTag.mockClear();
      revalidateFeatures(merchantId2);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `features-${merchantId2}`,
        'merchant'
      );
    });
  });

  describe('revalidatePageConfig', () => {
    it('revalidates page config cache', () => {
      revalidatePageConfig(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('revalidates specific page when slug provided', () => {
      const pageSlug = 'about-us';

      revalidatePageConfig(MERCHANT_ID, pageSlug);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `page-config-${MERCHANT_ID}-${pageSlug}`,
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    });

    it('handles empty slug gracefully', () => {
      revalidatePageConfig(MERCHANT_ID, '');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'page-config',
        'storefront-page'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('works with different merchant IDs and page slugs', () => {
      const merchantId = 'merchant-333';
      const pageSlug = 'contact';

      revalidatePageConfig(merchantId, pageSlug);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `page-config-${merchantId}-${pageSlug}`,
        'storefront-page'
      );
    });
  });

  describe('revalidateMerchantFeed', () => {
    it('revalidates only the merchant-scoped feed tag', () => {
      revalidateMerchantFeed('ogabassey');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'merchant-feed-ogabassey',
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('does not flush the global google-merchant-feed tag', () => {
      revalidateMerchantFeed('ogabassey');

      expect(mockRevalidateTag).not.toHaveBeenCalledWith(
        'google-merchant-feed',
        expect.anything()
      );
    });

    it('works with merchant UUID as identifier', () => {
      revalidateMerchantFeed(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `merchant-feed-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });
  });

  describe('revalidateDomains', () => {
    it('revalidates domains cache without domain', () => {
      revalidateDomains();

      expect(mockRevalidateTag).toHaveBeenCalledWith('domains', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('revalidates specific domain when provided', () => {
      const domain = 'example.com';

      revalidateDomains(domain);

      expect(mockRevalidateTag).toHaveBeenCalledWith('domains', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'domain-example.com',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    });

    it('converts domain to lowercase', () => {
      const domain = 'Example.COM';

      revalidateDomains(domain);

      expect(mockRevalidateTag).toHaveBeenCalledWith('domains', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'domain-example.com',
        'merchant'
      );
      expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    });

    it('handles empty domain gracefully', () => {
      revalidateDomains('');

      expect(mockRevalidateTag).toHaveBeenCalledWith('domains', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    });

    it('works with subdomain', () => {
      const domain = 'shop.example.com';

      revalidateDomains(domain);

      expect(mockRevalidateTag).toHaveBeenCalledWith('domains', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'domain-shop.example.com',
        'merchant'
      );
    });
  });

  describe('edge cases', () => {
    it('handles special characters in slugs', () => {
      revalidateProducts(MERCHANT_ID, 'test-product-123');

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `product-${MERCHANT_ID}-test-product-123`,
        'products'
      );
    });

    it('handles UUID merchant IDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';

      revalidateProducts(uuid);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${uuid}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${uuid}`,
        'merchant'
      );
    });

    it('does not throw when called multiple times rapidly', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          revalidateProducts(MERCHANT_ID);
        }
      }).not.toThrow();

      expect(mockRevalidateTag).toHaveBeenCalledTimes(900); // 9 calls per invocation * 100
    });

    it('handles null/undefined merchant IDs gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Expected in this runtime-guard test.
      });

      // TypeScript should prevent this, but test runtime behavior
      revalidateProducts(undefined as unknown as string);

      expect(mockRevalidateTag).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Skipped product cache revalidation for invalid merchant ID',
        { merchantId: undefined }
      );
      warnSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('multiple revalidations work together', () => {
      // Simulate a product update that affects multiple caches
      revalidateProducts(MERCHANT_ID, 'new-product');
      revalidateCategories(MERCHANT_ID, 'electronics');
      revalidateMerchant(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `categories-${MERCHANT_ID}`,
        'categories'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `dashboard-${MERCHANT_ID}`,
        'merchant'
      );
    });

    it('works when called sequentially in a workflow', () => {
      // Simulate a store publish workflow
      revalidateMerchant(MERCHANT_ID, 'my-store');
      revalidateProducts(MERCHANT_ID);
      revalidateFeatures(MERCHANT_ID);

      expect(mockRevalidateTag).toHaveBeenCalledWith('merchants', 'merchant');
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `products-${MERCHANT_ID}`,
        'products'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        `features-${MERCHANT_ID}`,
        'merchant'
      );
    });
  });
});
