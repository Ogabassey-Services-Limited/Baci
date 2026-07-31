import { describe, expect, it, vi } from 'vitest';
import {
  mockPostCreationSelectSequence,
  registerPostTestSetup,
  validPostData,
  validPostDataWithCategory,
} from './post.test-support';
import {
  MERCHANT_ID,
  makeRequest,
  managedFeaturedImageUrl,
  managedLandscapeVariantUrl,
  mockGetMerchantBlogCacheIdentifiers,
  mockInvokeEmbedding,
  mockRevalidateBlogPosts,
  mockSupabase,
  POST,
} from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts', () => {
  describe('successful post creation', () => {
    it('persists Discover image metadata for valid published posts', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: {
            ...validPostData,
            status: 'published',
            featured_image_url: managedFeaturedImageUrl,
            featured_image_width: 1200,
            featured_image_height: 675,
            featured_image_variants: {
              landscape_16x9: managedLandscapeVariantUrl,
            },
          },
        })
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeVariantUrl,
          },
        })
      );
    });

    it('calculates reading time and word count', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          word_count: expect.any(Number),
          reading_time_minutes: expect.any(Number),
        })
      );
    });

    it('returns only the explicit post projection after creation', async () => {
      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(mockSupabase.select).toHaveBeenCalledWith(
        'id, merchant_id, title, slug, content, excerpt, category, featured_image_url, status, published_at'
      );
    });

    it('triggers embedding generation through the authorized request client', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(mockInvokeEmbedding).toHaveBeenCalledWith('generate-embedding', {
        body: expect.objectContaining({ id: '1', type: 'blog' }),
      });
    });

    it('revalidates blog cache after creation', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1', slug: 'new-blog-post' },
        error: null,
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: [],
        postSlugs: ['new-blog-post'],
      });
    });

    it('forwards the created post category into blog cache revalidation', async () => {
      mockPostCreationSelectSequence({
        createdPost: {
          data: {
            id: '1',
            slug: 'new-blog-post',
            category: 'the-category-slug',
          },
          error: null,
        },
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: validPostDataWithCategory,
        })
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: ['the-category-slug'],
        postSlugs: ['new-blog-post'],
      });
    });

    it('warns when merchant slug is missing and still uses available identifiers', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      mockPostCreationSelectSequence({
        merchant: {
          data: { business_name: 'Test Store', slug: null },
          error: null,
        },
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Merchant slug missing during blog post revalidation; falling back to available blog identifiers only',
        {
          merchantId: MERCHANT_ID,
        }
      );
      expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledWith(
        mockSupabase,
        MERCHANT_ID
      );
      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: [],
        postSlugs: ['new-blog-post'],
      });
      consoleWarnSpy.mockRestore();
    });

    it('returns 500 when the merchant lookup fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      mockPostCreationSelectSequence({
        merchant: {
          data: null,
          error: { message: 'merchant lookup failed' },
        },
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load merchant details');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch merchant details for blog post creation:',
        expect.objectContaining({
          merchantId: MERCHANT_ID,
          error: { message: 'merchant lookup failed' },
        })
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
