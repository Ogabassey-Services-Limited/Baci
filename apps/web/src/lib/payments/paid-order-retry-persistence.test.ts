import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  PAID_ORDER_RETRY_STEPS,
  parseRetryInput,
  persistPaidOrderSideEffectRetry,
  WEBHOOK_SIDE_EFFECT_FAILURE_REASON,
} from '@/lib/payments/paid-order-retry-persistence';

function createSupabase(error: { message?: string } | null = null) {
  const upsert = vi.fn(async () => ({ data: null, error }));
  const from = vi.fn(() => ({ upsert }));
  return {
    from,
    supabase: { from } as unknown as SupabaseClient,
    upsert,
  };
}

describe('persistPaidOrderSideEffectRetry', () => {
  it('parses and trims retry input before persistence', () => {
    expect(
      parseRetryInput({
        error: new Error('side effects failed'),
        orderId: ' order-1 ',
        reference: ' PSK_REF_1 ',
        transaction: { id: ' transaction-1 ' },
      })
    ).toMatchObject({
      orderId: 'order-1',
      reference: 'PSK_REF_1',
      transaction: { id: 'transaction-1' },
    });
  });

  it('upserts retry rows for every paid-order side-effect step', async () => {
    const { supabase, upsert } = createSupabase();

    await persistPaidOrderSideEffectRetry({
      error: new Error('side effects failed'),
      orderId: 'order-1',
      reference: 'PSK_REF_1',
      supabase,
      transaction: { id: 'transaction-1' },
    });

    expect(upsert).toHaveBeenCalledWith(
      PAID_ORDER_RETRY_STEPS.map((step) =>
        expect.objectContaining({
          error: 'side effects failed',
          order_id: 'order-1',
          result: expect.objectContaining({
            reason: WEBHOOK_SIDE_EFFECT_FAILURE_REASON,
          }),
          status: 'failed',
          step,
          transaction_id: 'transaction-1',
        })
      ),
      { onConflict: 'order_id,step' }
    );
  });

  it('throws when retry persistence fails', async () => {
    const { supabase } = createSupabase({ message: 'upsert failed' });

    await expect(
      persistPaidOrderSideEffectRetry({
        error: 'failure',
        orderId: 'order-1',
        reference: 'PSK_REF_1',
        supabase,
        transaction: { id: 'transaction-1' },
      })
    ).rejects.toThrow(
      'Failed to persist paid order side-effect retry: upsert failed'
    );
  });

  it('rejects missing identifiers before upserting retry rows', async () => {
    const { supabase, upsert } = createSupabase();

    await expect(
      persistPaidOrderSideEffectRetry({
        error: 'failure',
        orderId: '',
        reference: 'PSK_REF_1',
        supabase,
        transaction: { id: 'transaction-1' },
      })
    ).rejects.toThrow(/orderId/);
    await expect(
      persistPaidOrderSideEffectRetry({
        error: 'failure',
        orderId: 'order-1',
        reference: '',
        supabase,
        transaction: { id: 'transaction-1' },
      })
    ).rejects.toThrow(/reference/);
    await expect(
      persistPaidOrderSideEffectRetry({
        error: 'failure',
        orderId: 'order-1',
        reference: 'PSK_REF_1',
        supabase,
        transaction: { id: '' },
      })
    ).rejects.toThrow(/transaction\.id/);
    expect(upsert).not.toHaveBeenCalled();
  });
});
