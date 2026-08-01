import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChainableMock,
  GET,
  makeRequest,
  mockHasPermission,
  mockSupabase,
  setupAuth,
} from './route.test-support';

describe('GET /api/merchant/blog/posts query validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createChainableMock());
    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
  });

  it('rejects an unallowlisted sort column before querying posts', async () => {
    const response = await GET(
      makeRequest('/api/merchant/blog/posts?sortBy=merchant_id')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Validation error' });
    expect(mockSupabase.order).not.toHaveBeenCalled();
  });

  it('rejects pagination outside the bounded list contract', async () => {
    const response = await GET(
      makeRequest('/api/merchant/blog/posts?limit=101&offset=-1')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Validation error' });
  });

  it('returns 500 when a status count query fails', async () => {
    const failedCountQuery = {
      eq: vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'count unavailable' },
      }),
    };
    mockSupabase.range.mockResolvedValue({ data: [], count: 0, error: null });
    mockSupabase.select
      .mockImplementationOnce(() => mockSupabase)
      .mockImplementationOnce(() => failedCountQuery);

    const response = await GET(makeRequest('/api/merchant/blog/posts'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch post counts',
    });
  });
});
