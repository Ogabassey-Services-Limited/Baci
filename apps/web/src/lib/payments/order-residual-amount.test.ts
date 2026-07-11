import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { computeOrderResidualAmount } from './order-residual-amount';

vi.mock('server-only', () => ({}));

function buildSupabase({
  walletRow = { wallet_amount_used: 0 } as Record<string, unknown> | null,
  walletError = null as unknown,
  savingsRows = [] as Record<string, unknown>[] | null,
  savingsError = null as unknown,
}: {
  walletRow?: Record<string, unknown> | null;
  walletError?: unknown;
  savingsRows?: Record<string, unknown>[] | null;
  savingsError?: unknown;
}) {
  // The orders query terminates in `.maybeSingle()` (a promise); the savings
  // query is awaited directly on the builder — awaiting this non-thenable object
  // resolves to the object itself, so its `data`/`error` fields carry the
  // savings result.
  const client = {
    from: vi.fn(() => client),
    select: vi.fn(() => client),
    eq: vi.fn(() => client),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: walletRow, error: walletError })
    ),
    data: savingsRows,
    error: savingsError,
  };
  return client as unknown as SupabaseClient;
}

const input = {
  orderId: 'order-1',
  merchantId: 'merchant-1',
  orderTotal: 130000,
};

describe('computeOrderResidualAmount', () => {
  it('subtracts wallet credit and redeemed savings from the order total', async () => {
    const result = await computeOrderResidualAmount(
      buildSupabase({
        walletRow: { wallet_amount_used: 65000 },
        savingsRows: [{ amount: 5000 }, { amount: 2500 }],
      }),
      input
    );

    expect(result).toEqual({
      ok: true,
      walletAmountUsed: 65000,
      savingsAmountUsed: 7500,
      residualAmount: 57500,
    });
  });

  it('returns the full total when no wallet or savings were applied', async () => {
    const result = await computeOrderResidualAmount(buildSupabase({}), input);

    expect(result).toEqual({
      ok: true,
      walletAmountUsed: 0,
      savingsAmountUsed: 0,
      residualAmount: 130000,
    });
  });

  it('floors the residual at zero when tender exceeds the total', async () => {
    const result = await computeOrderResidualAmount(
      buildSupabase({ walletRow: { wallet_amount_used: 200000 } }),
      input
    );

    expect(result).toEqual({
      ok: true,
      walletAmountUsed: 200000,
      savingsAmountUsed: 0,
      residualAmount: 0,
    });
  });

  it('ignores negative or non-numeric tender values', async () => {
    const result = await computeOrderResidualAmount(
      buildSupabase({
        walletRow: { wallet_amount_used: -5 },
        savingsRows: [{ amount: 'abc' }, { amount: 1000 }],
      }),
      input
    );

    expect(result).toEqual({
      ok: true,
      walletAmountUsed: 0,
      savingsAmountUsed: 1000,
      residualAmount: 129000,
    });
  });

  it('fails closed when the wallet lookup errors', async () => {
    const result = await computeOrderResidualAmount(
      buildSupabase({ walletRow: null, walletError: { message: 'db down' } }),
      input
    );

    expect(result).toEqual({ ok: false, reason: 'wallet_lookup_failed' });
  });

  it('fails closed when the savings lookup errors', async () => {
    const result = await computeOrderResidualAmount(
      buildSupabase({
        walletRow: { wallet_amount_used: 1000 },
        savingsError: { message: 'db down' },
      }),
      input
    );

    expect(result).toEqual({ ok: false, reason: 'savings_lookup_failed' });
  });
});
