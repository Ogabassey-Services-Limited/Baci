import { describe, expect, it, vi } from 'vitest';
import { hasSettledPaystackOrderPaymentReference } from './has-settled-paystack-order-payment-reference';

describe('hasSettledPaystackOrderPaymentReference', () => {
  it('returns true when a completed order transaction already owns the reference', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'tx-1' }],
      error: null,
    });
    const not = vi.fn(() => ({ limit }));
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const supabase = { from: vi.fn(() => ({ select })) } as never;

    await expect(
      hasSettledPaystackOrderPaymentReference({
        gatewayReference: 'R1',
        supabase,
      })
    ).resolves.toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('transactions');
  });

  it('returns false when no completed order transaction matches', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const not = vi.fn(() => ({ limit }));
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const supabase = { from: vi.fn(() => ({ select })) } as never;

    await expect(
      hasSettledPaystackOrderPaymentReference({
        gatewayReference: 'R1',
        supabase,
      })
    ).resolves.toBe(false);
  });
});
