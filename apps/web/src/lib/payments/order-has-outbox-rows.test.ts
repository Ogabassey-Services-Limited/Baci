import { describe, expect, it, vi } from 'vitest';
import { getOrderOutboxState } from '@/lib/payments/order-has-outbox-rows';

function buildSupabase(result: { data: unknown[] | null; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) };
}

describe('getOrderOutboxState', () => {
  it('marks lookup failures so callers do not infer settlement-only work', async () => {
    const state = await getOrderOutboxState(
      buildSupabase({ data: null, error: { message: 'unavailable' } }) as never,
      'order-1'
    );

    expect(state).toMatchObject({
      hasRows: true,
      lookupFailed: true,
      payerTransactionId: null,
    });
  });

  it('derives the payer transaction from a successful lookup', async () => {
    const state = await getOrderOutboxState(
      buildSupabase({
        data: [
          {
            error: 'side_effect_failed',
            status: 'failed',
            transaction_id: 'txn-1',
          },
        ],
        error: null,
      }) as never,
      'order-1'
    );

    expect(state).toMatchObject({
      hasRows: true,
      lookupFailed: false,
      payerTransactionId: 'txn-1',
    });
  });
});
