import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCronRequest,
  createScheduledPost,
  mockRevalidateBlogPosts,
  mockSupabase,
  POST,
  resetCronRouteMocks,
} from './route.test-support';

describe('scheduled-post publishing cron errors', () => {
  beforeEach(resetCronRouteMocks);
  afterEach(() => vi.unstubAllEnvs());

  it('stops before publishing when feature settings cannot be loaded', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSupabase.lte.mockResolvedValue({
      data: [createScheduledPost()],
      error: null,
    });
    mockSupabase.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'feature settings failed' },
    });

    try {
      const response = await POST(createCronRequest());
      await expect(response.json()).resolves.toEqual({
        error: 'Failed to load blog feature settings',
      });
      expect(response.status).toBe(500);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('stops before publishing when published blog counts cannot be loaded', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [createScheduledPost()],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [{ merchant_id: 'merchant-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'count failed' },
      });

    const response = await POST(createCronRequest());
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load published blog counts',
    });
    expect(response.status).toBe(500);
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });
});
