import { describe, expect, it, vi } from 'vitest';
import { clearPaymentSideEffectSeed } from '@/lib/payments/clear-payment-side-effect-seed';

function buildSupabase(error: { message: string } | null) {
  const chain: Record<string, unknown> = { error };
  chain.eq = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  const from = vi.fn(() => chain);
  return { chain, from, supabase: { from } };
}

describe('clearPaymentSideEffectSeed', () => {
  it('deletes only the untouched seed for the rolled-back transaction', async () => {
    const { chain, from, supabase } = buildSupabase(null);

    await clearPaymentSideEffectSeed({
      orderId: 'order-1',
      supabase: supabase as never,
      transactionId: 'txn-1',
    });

    expect(chain.delete).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith('payment_side_effects');
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'order_id', 'order-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'transaction_id', 'txn-1');
    expect(chain.eq).toHaveBeenNthCalledWith(3, 'status', 'failed');
    expect(chain.eq).toHaveBeenNthCalledWith(
      4,
      'error',
      'rpc_seed_pending_drain'
    );
  });

  it('fails closed when the seed cannot be cleared', async () => {
    const { supabase } = buildSupabase({ message: 'database unavailable' });

    await expect(
      clearPaymentSideEffectSeed({
        orderId: 'order-1',
        supabase: supabase as never,
        transactionId: 'txn-1',
      })
    ).rejects.toThrow(
      'payment_side_effect_seed_cleanup_failed: database unavailable'
    );
  });
});
