import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

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

// Mock CSRF
const mockCheckCsrfProtection = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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
    textSearch: vi.fn(),
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
  mock.textSearch.mockReturnValue(mock);
  mock.order.mockReturnValue(mock);
  mock.range.mockReturnValue(mock);

  return mock;
};

const mockSupabase = createChainableMock();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}));

// Mock global fetch for embedding generation
global.fetch = vi.fn();

// ---- Import handler AFTER mocks ----
import { GET, POST } from './route';

// ---- Constants ----

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const USER_ID = 'user-123';
const managedFeaturedImageUrl = `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/storage/v1/object/public/media/${MERCHANT_ID}/blog/cover.png`;
const managedLandscapeVariantUrl = `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/storage/v1/object/public/media/${MERCHANT_ID}/blog/upload-1/landscape_16x9.webp`;

// ---- Helpers ----

function makeRequest(
  url: string,
  options?: { body?: Record<string, unknown> }
) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: options?.body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
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

describe('GET /api/merchant/blog/posts', () => {
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

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing view permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
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

  describe('filtering and pagination', () => {
    it('returns all posts with counts when no filters applied', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Post 1',
          slug: 'post-1',
          status: 'published',
        },
        {
          id: '2',
          title: 'Post 2',
          slug: 'post-2',
          status: 'draft',
        },
      ];

      // Mock the main posts query
      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 2,
      });

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.posts).toEqual(mockPosts);
      expect(json.total).toBe(2);
      expect(json.counts).toBeDefined();
    });

    it('selects featured image metadata for dashboard list readiness state', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await GET(makeRequest('/api/merchant/blog/posts'));

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_width'),
        { count: 'exact' }
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_height'),
        { count: 'exact' }
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_variants'),
        { count: 'exact' }
      );
    });

    it('filters posts by status', async () => {
      const mockPosts = [
        { id: '1', title: 'Published Post', status: 'published' },
      ];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?status=published')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('filters posts by category', async () => {
      const mockPosts = [{ id: '1', title: 'Tech Post', category: 'tech' }];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?category=tech')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'tech');
    });

    it('searches posts using full-text search', async () => {
      const mockPosts = [{ id: '1', title: 'Searchable Post' }];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?search=searchable')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.textSearch).toHaveBeenCalledWith(
        'search_vector',
        'searchable',
        { type: 'websearch', config: 'english' }
      );
    });

    it('truncates search input to 100 characters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const longSearch = 'a'.repeat(150);
      await GET(makeRequest(`/api/merchant/blog/posts?search=${longSearch}`));

      expect(mockSupabase.textSearch).toHaveBeenCalledWith(
        'search_vector',
        'a'.repeat(100),
        { type: 'websearch', config: 'english' }
      );
    });

    it('applies pagination with limit and offset', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 50,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?limit=10&offset=20')
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.range).toHaveBeenCalledWith(20, 29);
      expect(json.limit).toBe(10);
      expect(json.offset).toBe(20);
      expect(json.hasMore).toBe(true);
    });

    it('applies custom sorting', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await GET(
        makeRequest('/api/merchant/blog/posts?sortBy=title&sortOrder=asc')
      );

      expect(mockSupabase.order).toHaveBeenCalledWith('title', {
        ascending: true,
      });
    });
  });

  describe('error handling', () => {
    it('returns 500 when database query fails', async () => {
      mockSupabase.range.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Database error');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.range.mockRejectedValue(new Error('Unexpected error'));

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('POST /api/merchant/blog/posts', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetBlogEmbeddingText.mockReturnValue('embedding text');
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
    });

    // Setup default mock responses
    // Mock single() to return appropriate data based on select field
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
        // Default for insert().select()
        mockSupabase.single.mockResolvedValueOnce({
          data: { id: '1', slug: 'new-blog-post' },
          error: null,
        });
      }
      return mockSupabase;
    });

    // Mock maybeSingle for slug check (default: no conflict)
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('authentication and authorization', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });

    it('returns 403 when user lacks marketing edit permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
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

  describe('CSRF protection', () => {
    it('returns error when CSRF validation fails', async () => {
      mockCheckCsrfProtection.mockResolvedValue({
        valid: false,
        response: new Response(
          JSON.stringify({ error: 'CSRF validation failed' }),
          {
            status: 403,
          }
        ),
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(res.status).toBe(403);
    });
  });

  describe('feature flags', () => {
    it('returns 403 when blog feature is not enabled', async () => {
      vi.spyOn(mockSupabase, 'select').mockImplementation((fields: string) => {
        if (
          fields === 'blog_enabled' ||
          fields === 'blog_enabled, blog_discover_image_validation_enabled'
        ) {
          return {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                blog_enabled: false,
                blog_discover_image_validation_enabled: false,
              },
              error: null,
            }),
          } as never;
        }
        if (fields === 'business_name, slug') {
          return {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { business_name: 'Test Store', slug: 'test-store' },
              error: null,
            }),
          } as never;
        }
        return mockSupabase;
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toContain('Blog feature is not enabled');
    });
  });

  describe('validation', () => {
    it('returns 400 when title is missing', async () => {
      const { title: _, ...invalidData } = validPostData;

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: invalidData })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation error');
      expect(json.details).toBeDefined();
    });

    it('returns 400 when content is missing', async () => {
      const { content: _, ...invalidData } = validPostData;

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: invalidData })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation error');
    });

    it('returns 400 when slug format is invalid', async () => {
      const invalidData = {
        ...validPostData,
        slug: 'Invalid Slug!',
      };

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: invalidData })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Validation error');
    });

    it('auto-generates slug from title when not provided', async () => {
      const { slug: _, ...dataWithoutSlug } = validPostData;

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1', slug: 'new-blog-post' },
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: dataWithoutSlug })
      );

      expect(res.status).toBe(201);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'new-blog-post',
        })
      );
    });

    it('uses default author name when not provided', async () => {
      const { author_name: _, ...dataWithoutAuthor } = validPostData;

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: dataWithoutAuthor })
      );

      expect(res.status).toBe(201);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          author_name: 'Test Store',
        })
      );
    });

    it('blocks publishing without Discover-ready metadata when validation is enabled', async () => {
      mockSupabase.select.mockImplementation((fields: string) => {
        if (fields === 'business_name, slug') {
          mockSupabase.single.mockResolvedValueOnce({
            data: { business_name: 'Test Store', slug: 'test-store' },
            error: null,
          });
        } else if (
          fields === 'blog_enabled, blog_discover_image_validation_enabled'
        ) {
          mockSupabase.single.mockResolvedValueOnce({
            data: {
              blog_enabled: true,
              blog_discover_image_validation_enabled: true,
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

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: { ...validPostData, status: 'published' },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY');
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('allows invalid image readiness with a warning when validation is disabled', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: { ...validPostData, status: 'published' },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.discoverImageReadiness).toMatchObject({
        ready: false,
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      });
    });

    it('rejects external variant URLs even when validation is disabled', async () => {
      const res = await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: {
            ...validPostData,
            featured_image_variants: {
              landscape_16x9: 'https://example.com/variant.webp',
            },
          },
        })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED');
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
  });

  describe('duplicate slug detection', () => {
    it('returns 409 when slug already exists', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { id: 'existing-post-id' },
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe('A post with this slug already exists');
    });
  });

  describe('successful post creation', () => {
    it('creates post with status 201 and returns post data', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe('1'); // From mock default
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('sets published_at when status is published', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1', published_at: expect.any(String) },
        error: null,
      });

      const publishedData = { ...validPostData, status: 'published' };

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: publishedData })
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          published_at: expect.any(String),
        })
      );
    });

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

    it('triggers embedding generation asynchronously', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/generate-embedding'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"id":"1"'), // From mock default
        })
      );
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
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: [],
        postSlugs: ['new-blog-post'],
      });
    });

    it('forwards the created post category into blog cache revalidation', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

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
            data: {
              id: '1',
              slug: 'new-blog-post',
              category: 'the-category-slug',
            },
            error: null,
          });
        }
        return mockSupabase;
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: validPostDataWithCategory,
        })
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
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

      mockSupabase.select.mockImplementation((fields: string) => {
        if (fields === 'business_name, slug') {
          mockSupabase.single.mockResolvedValueOnce({
            data: { business_name: 'Test Store', slug: null },
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

      mockSupabase.select.mockImplementation((fields: string) => {
        if (fields === 'business_name, slug') {
          mockSupabase.single.mockResolvedValueOnce({
            data: null,
            error: { message: 'merchant lookup failed' },
          });
        }

        return mockSupabase;
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

  describe('error handling', () => {
    it('returns 500 when database insert fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      // Make insert throw an error directly
      mockSupabase.insert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.maybeSingle.mockRejectedValue(new Error('Unexpected error'));

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });

    it('continues operation if embedding generation fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Embedding failed')
      );

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(res.status).toBe(201);
    });
  });
});
