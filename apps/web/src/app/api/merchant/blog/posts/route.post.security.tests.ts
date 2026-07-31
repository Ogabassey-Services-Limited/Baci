import { describe, expect, it } from 'vitest';
import {
  mockPostCreationSelectSequence,
  registerPostTestSetup,
  validPostData,
} from './post.test-support';
import {
  MERCHANT_ID,
  makeRequest,
  mockCheckCsrfProtection,
  mockHasPermission,
  mockSupabase,
  POST,
  setupAuth,
} from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts', () => {
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

    it('authenticates before evaluating CSRF for unauthenticated requests', async () => {
      setupAuth(false, false);
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

      expect(res.status).toBe(401);
      expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
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

    it('requires marketing create permission when creating a post', async () => {
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
        'create'
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
      mockPostCreationSelectSequence({
        featureSettings: {
          data: {
            blog_enabled: false,
            blog_discover_image_validation_enabled: false,
          },
          error: null,
        },
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
      mockPostCreationSelectSequence({
        featureSettings: {
          data: {
            blog_enabled: true,
            blog_discover_image_validation_enabled: true,
          },
          error: null,
        },
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
  });
});
