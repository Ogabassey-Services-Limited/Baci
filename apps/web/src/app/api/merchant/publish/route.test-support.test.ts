import { describe, expect, it } from 'vitest';
import {
  createMockSupabase,
  incompleteLaunchReadiness,
  MERCHANT_ID,
  mockAuthenticateApiRequest,
  mockMerchantUpdate,
  resetPublishRouteMocks,
  setupAuthenticatedRequest,
} from './route.test-support';

describe('publish route test support', () => {
  it('retains canonical product totals and captures mutation scope', async () => {
    const supabase = createMockSupabase();
    const result = await supabase
      .from('merchants')
      .update({ ok: true })
      .eq('id', MERCHANT_ID);

    expect(
      incompleteLaunchReadiness('first_product', 5).totalProductCount
    ).toBe(5);
    expect(mockMerchantUpdate).toHaveBeenCalledWith(
      { ok: true },
      'id',
      MERCHANT_ID
    );
    expect(result.error).toBeNull();
  });

  it('clears queued auth outcomes and restores authenticated defaults between tests', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Expired session',
      supabase: null,
      user: null,
    });

    resetPublishRouteMocks();
    const supabase = setupAuthenticatedRequest();

    await expect(mockAuthenticateApiRequest()).resolves.toEqual({
      error: null,
      supabase,
      user: { id: 'user-123' },
    });
  });
});
