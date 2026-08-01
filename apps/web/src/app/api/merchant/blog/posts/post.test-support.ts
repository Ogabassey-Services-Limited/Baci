import { beforeEach, vi } from 'vitest';
import { BLOG_POST_MUTATION_PROJECTION } from './blog-post-mutation-projection';
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

type SupabaseResponse<T> = {
  data: T;
  error: { message: string } | null;
};

type PostCreationSelectResponses = {
  createdPost?: SupabaseResponse<Record<string, unknown> | null>;
  existingPost?: SupabaseResponse<{ id: string } | null>;
  featureSettings?: SupabaseResponse<{
    blog_discover_image_validation_enabled: boolean;
    blog_enabled: boolean;
  } | null>;
  merchant?: SupabaseResponse<{
    business_name: string;
    slug: string | null;
  } | null>;
};

function mockPostCreationSelectSequence({
  createdPost = { data: { id: '1', slug: 'new-blog-post' }, error: null },
  existingPost = { data: null, error: null },
  featureSettings = {
    data: {
      blog_enabled: true,
      blog_discover_image_validation_enabled: false,
    },
    error: null,
  },
  merchant = {
    data: { business_name: 'Test Store', slug: 'test-store' },
    error: null,
  },
}: PostCreationSelectResponses = {}) {
  mockSupabase.select.mockImplementation((fields: string) => {
    if (fields === 'business_name, slug') {
      mockSupabase.single.mockResolvedValueOnce(merchant);
    } else if (
      fields === 'blog_enabled, blog_discover_image_validation_enabled'
    ) {
      mockSupabase.maybeSingle.mockResolvedValueOnce(featureSettings);
    } else if (fields === 'id') {
      mockSupabase.maybeSingle.mockResolvedValueOnce(existingPost);
    } else if (fields === BLOG_POST_MUTATION_PROJECTION) {
      mockSupabase.single.mockResolvedValueOnce(createdPost);
    }
    return mockSupabase;
  });
}

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
    mockPostCreationSelectSequence();
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.rpc.mockImplementation(
      (
        _functionName: string,
        arguments_: { p_post_data: Record<string, unknown> }
      ) => {
        mockSupabase.insert(arguments_.p_post_data);
        mockSupabase.select(BLOG_POST_MUTATION_PROJECTION);
        return Promise.resolve({
          data: [
            {
              id: '1',
              merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
              ...arguments_.p_post_data,
            },
          ],
          error: null,
        });
      }
    );
  });
}

export {
  mockPostCreationSelectSequence,
  registerPostTestSetup,
  validPostData,
  validPostDataWithCategory,
};
