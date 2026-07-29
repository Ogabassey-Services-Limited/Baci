import { describe, expect, it } from 'vitest';
import {
  createMockSupabase,
  incompleteLaunchReadiness,
  MERCHANT_ID,
  mockMerchantUpdate,
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
});
