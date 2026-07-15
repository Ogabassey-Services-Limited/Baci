import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { resolvePaypalSplit } from './resolve-paypal-split';

vi.mock('server-only', () => ({}));

function buildClient(input: {
  order?: Record<string, unknown> | null;
  orderError?: unknown;
  savings?: Array<{ amount: number }>;
  savingsError?: unknown;
}): SupabaseClient {
  let table = '';
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () =>
      Promise.resolve({
        data: input.order ?? null,
        error: input.orderError ?? null,
      }),
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === 'customer_savings_redemptions'
            ? (input.savings ?? [])
            : null,
        error:
          table === 'customer_savings_redemptions'
            ? (input.savingsError ?? null)
            : null,
      }).then(resolve),
  };
  return {
    from: (nextTable: string) => {
      table = nextTable;
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('resolvePaypalSplit', () => {
  it('uses the persisted split while retaining savings and customer context', async () => {
    const result = await resolvePaypalSplit(
      buildClient({
        order: {
          total: 130000,
          wallet_amount_used: 30000,
          customer_id: 'customer-1',
        },
        savings: [{ amount: 20000 }],
      }),
      'merchant-1',
      'order-1',
      { paypal_split: { paypalResidualPaid: 80000, prepaidPaid: 50000 } }
    );

    expect(result).toEqual({
      paypalResidualPaid: 80000,
      prepaidPaid: 50000,
      savingsAmountUsed: 20000,
      customerId: 'customer-1',
    });
  });

  it('fails closed when the order lookup fails', async () => {
    const result = await resolvePaypalSplit(
      buildClient({ orderError: { message: 'unavailable' } }),
      'merchant-1',
      'order-1',
      {}
    );

    expect(result).toEqual({ failed: true, reason: 'order_lookup_failed' });
  });
});
