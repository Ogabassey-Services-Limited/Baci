import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('GET /api/search/autocomplete cache failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.rpc.mockReset();
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    vi.mocked(createClient).mockReturnValue(mockSupabase as never);
  });

  it('uses one ranked RPC for repeated zero-result autocomplete queries', async () => {
    const url = `http://localhost:3000/api/search/autocomplete?q=zero-cache&merchant_id=${MERCHANT_ID}&limit=10`;

    const first = await GET(new NextRequest(url));
    const second = await GET(new NextRequest(url));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        merchant_id_param: MERCHANT_ID,
        search_query: 'zero-cache',
      })
    );
  });

  it('validates parameters before consulting a cached autocomplete response', async () => {
    const cachedUrl = `http://localhost:3000/api/search/autocomplete?q=validation-cache&merchant_id=${MERCHANT_ID}&limit=10`;

    const cachedResponse = await GET(new NextRequest(cachedUrl));
    const invalidResponse = await GET(
      new NextRequest(
        `http://localhost:3000/api/search/autocomplete?q=validation-cache&merchant_id=${MERCHANT_ID}&limit=not-a-number`
      )
    );

    expect(cachedResponse.status).toBe(200);
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toEqual({
      error: 'Invalid autocomplete parameters',
    });
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('retries after a timeout instead of caching the empty timeout fallback', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '57014',
          message: 'canceling statement due to statement timeout',
        },
      })
      .mockResolvedValueOnce({ data: [], error: null });
    const url = `http://localhost:3000/api/search/autocomplete?q=timeout-retry&merchant_id=${MERCHANT_ID}&limit=10`;

    const timeoutResponse = await GET(new NextRequest(url));
    const retryResponse = await GET(new NextRequest(url));

    expect(timeoutResponse.status).toBe(200);
    expect(await timeoutResponse.json()).toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('retries after a 500 instead of caching the failed autocomplete response', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'XX000', message: 'database failure' },
      })
      .mockResolvedValueOnce({ data: [], error: null });
    const url = `http://localhost:3000/api/search/autocomplete?q=server-error-retry&merchant_id=${MERCHANT_ID}&limit=10`;

    const failureResponse = await GET(new NextRequest(url));
    const retryResponse = await GET(new NextRequest(url));

    expect(failureResponse.status).toBe(500);
    expect(await failureResponse.json()).toEqual({
      error: 'Failed to get autocomplete suggestions',
    });
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });
});
