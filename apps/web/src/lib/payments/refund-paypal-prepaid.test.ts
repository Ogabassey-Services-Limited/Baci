import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restorePrepaidTender } from './refund-paypal-prepaid';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

function buildSupabase({
  existing = null,
  creditRows = [{ transaction_id: 'wc-1' }],
  creditError = null,
  savingsRows = [] as Array<{ id: string; metadata: Record<string, unknown> }>,
}: {
  existing?: { id: string } | null;
  creditRows?: unknown;
  creditError?: unknown;
  savingsRows?: Array<{ id: string; metadata: Record<string, unknown> }>;
}) {
  let table = '';
  const rpc = vi.fn(() =>
    Promise.resolve({ data: creditRows, error: creditError })
  );
  const builder = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    update: () => builder,
    maybeSingle: () => Promise.resolve({ data: existing, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'customer_savings_redemptions' ? savingsRows : null,
        error: null,
      }).then(resolve),
  };
  const client = {
    from: (t: string) => {
      table = t;
      return builder;
    },
    rpc,
  };
  return { client: client as unknown as SupabaseClient, rpc };
}

const base = {
  merchantId: 'm1',
  orderId: 'o1',
  orderNumber: 'BACI-1',
  reason: 'Order cancelled',
};

beforeEach(() => vi.clearAllMocks());

describe('restorePrepaidTender', () => {
  it('returns nothing to restore when prepaidPaid is 0', async () => {
    const { client, rpc } = buildSupabase({});
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 0,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when there is prepaid tender but no customer to credit', async () => {
    const { client, rpc } = buildSupabase({});
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: null,
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is idempotent: a prior wallet-refund audit row short-circuits a second credit (exactly-once)', async () => {
    const { client, rpc } = buildSupabase({ existing: { id: 'prev-wc' } });
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toMatchObject({
      restored: 15000,
      walletCreditId: 'prev-wc',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('credits the wallet for the full prepaid and marks savings reversed', async () => {
    const { client, rpc } = buildSupabase({
      savingsRows: [{ id: 's1', metadata: {} }],
    });
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 50000,
      savingsAmountUsed: 20000,
    });
    expect(result).toMatchObject({
      restored: 50000,
      walletCreditId: 'wc-1',
      savingsRestored: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      'credit_customer_wallet',
      expect.objectContaining({
        p_customer_id: 'c1',
        p_merchant_id: 'm1',
        p_amount: 50000,
        p_source_id: 'o1',
      })
    );
  });

  it('does not report restored when the wallet credit RPC errors', async () => {
    const { client } = buildSupabase({ creditError: { message: 'rpc down' } });
    const result = await restorePrepaidTender(client, {
      ...base,
      customerId: 'c1',
      prepaidPaid: 15000,
      savingsAmountUsed: 0,
    });
    expect(result).toEqual({ restored: 0, savingsRestored: false });
  });
});
