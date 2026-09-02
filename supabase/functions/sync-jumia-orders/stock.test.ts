import { describe, expect, it, vi } from 'vitest';
import { syncJumiaStockForIntegration } from './stock';

function createSupabase(result: { data: unknown[] | null; error: unknown }) {
  let eqCalls = 0;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => {
      eqCalls += 1;
      return eqCalls === 4 ? Promise.resolve(result) : query;
    }),
  };
  return { from: vi.fn(() => query), query };
}

describe('syncJumiaStockForIntegration', () => {
  it('does nothing when an integration has no mappings', async () => {
    const { query, ...supabase } = createSupabase({ data: [], error: null });

    const result = await syncJumiaStockForIntegration({
      supabase: supabase as never,
      integration: {
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        marketplace_key: 'oauth',
      } as never,
      accessToken: 'access-token',
      config: { apiBase: 'https://vendor-api.example' },
      refreshToken: vi.fn(),
    });

    expect(result).toEqual({ updated: 0, skipped: 0 });
    expect(query.eq).toHaveBeenCalledWith('marketplace_key', 'oauth');
  });

  it('fails closed on a mapping lookup error without calling Jumia', async () => {
    const { query, ...supabase } = createSupabase({
      data: null,
      error: { message: 'temporary database failure' },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await syncJumiaStockForIntegration({
      supabase: supabase as never,
      integration: {
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        marketplace_key: 'oauth',
      } as never,
      accessToken: 'access-token',
      config: { apiBase: 'https://vendor-api.example' },
      refreshToken: vi.fn(),
    });

    expect(result).toEqual({ updated: 0, skipped: 0 });
    expect(query.eq).toHaveBeenCalledWith('marketplace_key', 'oauth');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
