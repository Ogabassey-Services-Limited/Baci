import { describe, expect, it, type vi } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import { makeRequest, mockSupabase, POST } from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts', () => {
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

    it('returns a stable error when the atomic create mutation fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'Insert failed' },
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to persist post');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

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
