import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock API auth
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

// Mock cache revalidation
const mockRevalidateBlogPosts = vi.fn();
const mockGetMerchantBlogCacheIdentifiers = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateBlogPosts: (...args: unknown[]) => mockRevalidateBlogPosts(...args),
}));

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogRevalidationContext: (...args: unknown[]) =>
    mockGetMerchantBlogCacheIdentifiers(...args),
}));

// Mock embeddings
const mockGetBlogEmbeddingText = vi.fn();

vi.mock('@/lib/embeddings', () => ({
  getBlogEmbeddingText: (...args: unknown[]) =>
    mockGetBlogEmbeddingText(...args),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Supabase mock - create a chainable mock
const createChainableMock = () => {
  const mock = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  // Make all methods return the mock for chaining
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.insert.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
  mock.delete.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.neq.mockReturnValue(mock);
  mock.or.mockReturnValue(mock);
  mock.order.mockReturnValue(mock);
  mock.range.mockReturnValue(mock);

  return mock;
};

const mockSupabase = createChainableMock();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

// Mock global fetch for embedding generation
global.fetch = vi.fn();

// ---- Import handler AFTER mocks ----
import { DELETE, GET, PATCH } from './route';

// ---- Constants ----

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const USER_ID = 'user-123';
const POST_ID = 'post-abc-123';
const managedFeaturedImageUrl = `https://cdn.example.com/storage/v1/object/public/media/${MERCHANT_ID}/blog/cover.png`;
const managedLandscapeVariantUrl = `https://cdn.example.com/storage/v1/object/public/media/${MERCHANT_ID}/blog/upload-1/landscape_16x9.webp`;

// ---- Helpers ----

function makeRequest(
  url: string,
  method: 'GET' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });
}

function makeParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function setupAuth(hasAuth = true, hasAccess = true) {
  if (hasAuth) {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: USER_ID },
      supabase: mockSupabase,
    });
  } else {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });
  }

  if (hasAccess) {
    mockGetUserAccess.mockResolvedValue({
      merchantId: MERCHANT_ID,
      role: 'owner',
    });
  } else {
    mockGetUserAccess.mockResolvedValue(null);
  }
}

// ---- Tests ----

describe('GET /api/merchant/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing view permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        { merchantId: MERCHANT_ID, role: 'owner' },
        'marketing',
        'view'
      );
    });
  });

  describe('fetching post', () => {
    it('returns post when found', async () => {
      const mockPost = {
        id: POST_ID,
        title: 'Test Post',
        slug: 'test-post',
        content: 'Post content',
        merchant_id: MERCHANT_ID,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockPost,
        error: null,
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockPost);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', POST_ID);
      expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    });

    it('selects featured image metadata for edit form hydration', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: POST_ID,
          title: 'Test Post',
          slug: 'test-post',
        },
        error: null,
      });

      await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_width')
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_height')
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_variants')
      );
    });

    it('returns 404 when post not found (PGRST116 error)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Post not found');
    });

    it('returns 500 when database error occurs', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });

  describe('error handling', () => {
    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Unexpected error'));

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('PATCH /api/merchant/blog/posts/[id]', () => {
  const existingPost = {
    id: POST_ID,
    title: 'Original Title',
    slug: 'original-slug',
    content: 'Original content',
    status: 'draft',
    merchant_id: MERCHANT_ID,
    featured_image_url: null,
    featured_image_width: null,
    featured_image_height: null,
    featured_image_variants: {},
  };

  const validUpdateData = {
    title: 'Updated Title',
    content: '<p>Updated content</p>',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
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

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing edit permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        { merchantId: MERCHANT_ID, role: 'owner' },
        'marketing',
        'edit'
      );
    });
  });

  describe('post existence check', () => {
    it('returns 404 when post does not exist', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Post not found');
    });
  });

  describe('validation', () => {
    it('returns 400 when validation fails', async () => {
      const invalidData = {
        title: '', // Empty title should fail
      };

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          invalidData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation error');
      expect(json.details).toBeDefined();
    });

    it('returns 400 when slug format is invalid', async () => {
      const invalidData = {
        slug: 'Invalid Slug!',
      };

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          invalidData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation error');
    });

    it('blocks draft-to-published updates without Discover-ready metadata when validation is enabled', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: existingPost,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: true,
        },
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('rejects external variant URLs regardless of rollout flag', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: existingPost,
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
          featured_image_variants: {
            landscape_16x9: 'https://example.com/variant.webp',
          },
        }),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });

  describe('slug conflict detection', () => {
    it('returns 409 when new slug conflicts with another post', async () => {
      const updateWithNewSlug = {
        slug: 'new-slug',
        title: 'Updated Title', // Need at least one other field for validation
      };

      // Mock the slug check to find a conflicting post
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { id: 'other-post-id' },
        error: null,
      });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          updateWithNewSlug
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe('A post with this slug already exists');
    });

    it('allows update when slug is unchanged', async () => {
      const updateWithSameSlug = {
        slug: 'original-slug',
        title: 'New Title',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, title: 'New Title' },
          error: null,
        });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          updateWithSameSlug
        ),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
    });

    it('allows update when new slug does not conflict', async () => {
      const updateWithNewSlug = {
        slug: 'unique-new-slug',
        title: 'Updated Title', // Need at least one other field for validation
      };

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...existingPost,
            slug: 'unique-new-slug',
            title: 'Updated Title',
          },
          error: null,
        });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          updateWithNewSlug
        ),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
    });
  });

  describe('successful update', () => {
    it('updates post and returns updated data', async () => {
      const updatedPost = {
        ...existingPost,
        ...validUpdateData,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: updatedPost,
          error: null,
        });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.title).toBe('Updated Title');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('recalculates word count and reading time when content changes', async () => {
      const newContent =
        '<p>New content with many words to test reading time</p>';

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: newContent },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          content: newContent,
          title: 'Updated Title', // Schema requires at least title or content
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify the update was called with calculated values
      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall).toHaveProperty('word_count');
      expect(updateCall).toHaveProperty('reading_time_minutes');
      expect(typeof updateCall.word_count).toBe('number');
      expect(typeof updateCall.reading_time_minutes).toBe('number');
    });

    it('sets published_at when changing status from draft to published', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title', // Schema requires at least title or content
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify the update was called with published_at
      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall).toHaveProperty('published_at');
      expect(typeof updateCall.published_at).toBe('string');
    });

    it('allows unrelated edits to legacy published posts with unchanged image metadata', async () => {
      const legacyPublishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2026-01-01T00:00:00Z',
        featured_image_url: managedFeaturedImageUrl,
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: legacyPublishedPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...legacyPublishedPost, title: 'Updated Title' },
          error: null,
        });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: true,
        },
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Title' })
      );
    });

    it('persists valid Discover metadata when publishing', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
          error: null,
        });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: true,
        },
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
          status: 'published',
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeVariantUrl,
          },
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
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

    it('does not override published_at when already published', async () => {
      const publishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: publishedPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: publishedPost,
          error: null,
        });

      await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall.published_at).toBeUndefined();
    });

    it('triggers embedding regeneration when content changes', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: validUpdateData.content },
          error: null,
        });

      await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/generate-embedding'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(POST_ID),
        })
      );
    });

    it('revalidates blog cache after update', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, slug: 'updated-slug' },
          error: null,
        });

      await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: [],
        postSlugs: ['original-slug', 'updated-slug'],
      });
    });

    it('returns 500 when blog cache identifier setup fails before update', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: validUpdateData.content },
          error: null,
        });
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('cache setup failed')
      );

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
      expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 500 when database update fails', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Update failed' },
        });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to update post');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Unexpected error'));

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });

    it('continues operation if embedding regeneration fails', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: validUpdateData.content },
          error: null,
        });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Embedding failed')
      );

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
    });
  });
});

describe('DELETE /api/merchant/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { slug: 'deleted-post', category: 'tech' },
      error: null,
    });
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing edit permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        { merchantId: MERCHANT_ID, role: 'owner' },
        'marketing',
        'edit'
      );
    });
  });

  describe('successful deletion', () => {
    it('deletes post and returns success', async () => {
      // eq() call order: fetch existing post id -> fetch existing post merchant_id
      // -> delete post id -> delete post merchant_id
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', POST_ID);
      expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    });

    it('revalidates blog cache after deletion', async () => {
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));

      await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: ['tech'],
        postSlugs: ['deleted-post'],
      });
    });

    it('returns 500 when blog cache identifier setup fails before deletion', async () => {
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('cache setup failed')
      );

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
      expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 500 when the pre-delete lookup fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Lookup failed' },
      });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load post for deletion');
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('returns 500 when database delete fails', async () => {
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() =>
          Promise.resolve({ error: { message: 'Delete failed' } })
        );

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to delete post');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.delete.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
