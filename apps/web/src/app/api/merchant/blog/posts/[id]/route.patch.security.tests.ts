import { describe, expect, it, vi } from 'vitest';
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

    it('fails open when Discover feature settings cannot be loaded', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

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
        data: null,
        error: { message: 'settings unavailable' },
      });

      try {
        const res = await PATCH(
          makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
            status: 'published',
            title: 'Updated Title',
          }),
          makeParams(POST_ID)
        );

        expect(res.status).toBe(200);
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'published' })
        );
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to load blog feature settings for discover enforcement',
          expect.objectContaining({
            merchantId: MERCHANT_ID,
            error: 'settings unavailable',
          })
        );
      } finally {
        warnSpy.mockRestore();
      }
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
