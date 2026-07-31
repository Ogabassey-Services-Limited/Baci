import { describe, expect, it } from 'vitest';
import {
  existingPost,
  registerPatchTestSetup,
  validUpdateData,
} from './patch.test-support';
import {
  MERCHANT_ID,
  makeParams,
  makeRequest,
  mockHasPermission,
  mockSupabase,
  PATCH,
  POST_ID,
  setupAuth,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
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
        error: { code: 'PGRST116', message: 'Not found' },
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

    it('returns 500 when loading the post fails for a reason other than not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'database unavailable' },
      });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'Failed to load post',
      });
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

    it('fails closed when Discover feature settings cannot be loaded', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'settings unavailable' },
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'Failed to load blog settings',
      });
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
});
