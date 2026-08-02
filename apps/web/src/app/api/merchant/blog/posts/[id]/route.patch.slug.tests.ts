import { describe, expect, it } from 'vitest';
import { existingPost, registerPatchTestSetup } from './patch.test-support';
import {
  makeParams,
  makeRequest,
  mockSupabase,
  PATCH,
  POST_ID,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
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

    it('fails closed when the tenant-scoped slug check fails', async () => {
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'slug query failed' },
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          slug: 'unique-new-slug',
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'Failed to validate post slug',
      });
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });
});
