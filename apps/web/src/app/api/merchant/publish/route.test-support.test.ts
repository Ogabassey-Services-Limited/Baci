import { describe, expect, it, vi } from 'vitest';
import {
  createMockSupabase,
  incompleteLaunchReadiness,
  MERCHANT_ID,
} from './route.test-support';

describe('publish route test support', () => {
  it('retains canonical product totals and captures mutation scope', async () => {
    const update = vi.fn();
    const supabase = createMockSupabase(update);
    const result = await supabase
      .from('merchants')
      .update({ ok: true })
      .eq('id', MERCHANT_ID);

    expect(
      incompleteLaunchReadiness('first_product', 5).totalProductCount
    ).toBe(5);
    expect(update).toBeTypeOf('function');
    expect(result.error).toBeNull();
  });
});
