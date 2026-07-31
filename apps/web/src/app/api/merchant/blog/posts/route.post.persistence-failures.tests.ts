import { describe, expect, it } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import {
  makeRequest,
  mockCheckCsrfProtection,
  mockSupabase,
  POST,
} from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts persistence failures', () => {
  it('returns 403 when CSRF fails without a response object', async () => {
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', { body: validPostData })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'CSRF validation failed' });
  });

  it('returns 500 when feature settings cannot be loaded', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'settings unavailable' },
    });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', { body: validPostData })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load blog settings',
    });
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it('returns 500 when the tenant-scoped slug lookup fails', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'slug lookup failed' },
      });

    const response = await POST(
      makeRequest('/api/merchant/blog/posts', { body: validPostData })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to validate post slug',
    });
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });
});
