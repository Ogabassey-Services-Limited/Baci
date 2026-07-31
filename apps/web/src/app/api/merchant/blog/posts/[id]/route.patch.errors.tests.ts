import { describe, expect, it, type vi } from 'vitest';
import {
  existingPost,
  registerPatchTestSetup,
  validUpdateData,
} from './patch.test-support';
import {
  makeParams,
  makeRequest,
  mockSupabase,
  PATCH,
  POST_ID,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
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
