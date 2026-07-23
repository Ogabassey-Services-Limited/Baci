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

  it('identifies an aged untouched seed as owed pre-push work', async () => {
    const state = await getOrderOutboxState(
      buildSupabase({
        data: [
          {
            claimed_at: '2020-01-01T00:00:00.000Z',
            error: 'rpc_seed_pending_drain',
            result: { reason: 'seeded_at_completion' },
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
      onlyFreshPrePushEvidence: false,
      onlyUntouchedSeed: true,
      payerTransactionId: 'txn-1',
    });
  });

  it('reports no rows without inferring an untouched seed', async () => {
    const state = await getOrderOutboxState(
      buildSupabase({ data: [], error: null }) as never,
      'order-1'
    );

    expect(state).toMatchObject({
      hasRows: false,
      onlyFreshPrePushEvidence: false,
      onlyUntouchedSeed: false,
      payerTransactionId: null,
    });
  });
});
