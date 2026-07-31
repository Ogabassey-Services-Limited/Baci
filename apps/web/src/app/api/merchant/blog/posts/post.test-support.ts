import { beforeEach, vi } from 'vitest';
import {
  createChainableMock,
  mockCheckCsrfProtection,
  mockDispatchZohoBlogCampaign,
  mockGetBlogEmbeddingText,
  mockGetMerchantBlogCacheIdentifiers,
  mockHasPermission,
  mockSupabase,
  setupAuth,
} from './route.test-support';

const validPostData = {
  title: 'New Blog Post',
  slug: 'new-blog-post',
  content: '<p>This is the content of the blog post.</p>',
  author_name: 'John Doe',
  status: 'draft',
};

const validPostDataWithCategory = {
  ...validPostData,
  category: 'the-category-slug',
};

function registerPostTestSetup() {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createChainableMock());
    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: 'post-1',
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });
    mockGetBlogEmbeddingText.mockReturnValue('embedding text');
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    mockSupabase.select.mockImplementation((fields: string) => {
      if (fields === 'business_name, slug') {
        mockSupabase.single.mockResolvedValueOnce({
          data: { business_name: 'Test Store', slug: 'test-store' },
          error: null,
        });
      } else if (
        fields === 'blog_enabled' ||
        fields === 'blog_enabled, blog_discover_image_validation_enabled'
      ) {
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            blog_enabled: true,
            blog_discover_image_validation_enabled: false,
          },
          error: null,
        });
      } else {
        mockSupabase.single.mockResolvedValueOnce({
          data: { id: '1', slug: 'new-blog-post' },
          error: null,
        });
      }
      return mockSupabase;
    });
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });
}

export { registerPostTestSetup, validPostData, validPostDataWithCategory };
