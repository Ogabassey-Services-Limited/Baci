import { describe, expect, it, vi } from 'vitest';
import type { ServiceRoleClient } from '@/lib/payments/paid-order-side-effect-types';
import { loadGiglSettlementRetainedAmount } from './load-gigl-settlement-retained-amount';

function createSupabase(result: {
  data: { metadata: Record<string, unknown> } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
    supabase: { from } as unknown as ServiceRoleClient,
  };
}

describe('loadGiglSettlementRetainedAmount', () => {
  it('reads the authoritative retained amount from settlement metadata', async () => {
    const { from, supabase } = createSupabase({
      data: { metadata: { retained_shipping_amount: 8_500 } },
      error: null,
    });

    await expect(
      loadGiglSettlementRetainedAmount(supabase, 'BAC-REF-1')
    ).resolves.toBe(8_500);
    expect(from).toHaveBeenCalledWith('merchant_settlements');
  });

  it('fails closed when the settlement row is missing', async () => {
    const { supabase } = createSupabase({ data: null, error: null });

    await expect(
      loadGiglSettlementRetainedAmount(supabase, 'BAC-REF-1')
    ).rejects.toThrow('settlement row missing');
  });
});
