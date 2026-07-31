import { beforeEach, vi } from 'vitest';
import {
  createChainableMock,
  MERCHANT_ID,
  mockDispatchZohoBlogCampaign,
  mockGetBlogEmbeddingText,
  mockGetMerchantBlogCacheIdentifiers,
  mockHasPermission,
  mockSubmitIndexNowUrls,
  mockSupabase,
  POST_ID,
  setupAuth,
} from './route.test-support';
export const existingPost = {
  id: POST_ID,
  title: 'Original Title',
  slug: 'original-slug',
  content: 'Original content',
  excerpt: null,
  category: null,
  published_at: null,
  status: 'draft',
  merchant_id: MERCHANT_ID,
  featured_image_url: null,
  featured_image_width: null,
  featured_image_height: null,
  featured_image_variants: {},
};

export const validUpdateData = {
  title: 'Updated Title',
  content: '<p>Updated content</p>',
};

function registerPatchTestSetup() {
  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: POST_ID,
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });
    mockSubmitIndexNowUrls.mockResolvedValue({
      endpoint: 'https://api.indexnow.org/indexnow',
      responseStatus: 202,
      status: 'submitted',
      submitted: 1,
    });
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    mockGetBlogEmbeddingText.mockReturnValue('embedding text');
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
    });

    // Mock existing post fetch (default)
    mockSupabase.single.mockResolvedValue({
      data: existingPost,
      error: null,
    });

    // Mock maybeSingle for slug check (default: no conflict)
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });
}

export { registerPatchTestSetup };
