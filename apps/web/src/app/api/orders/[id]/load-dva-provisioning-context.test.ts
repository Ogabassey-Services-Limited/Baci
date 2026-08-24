import { describe, expect, it, vi } from 'vitest';
import { loadDvaProvisioningContext } from './load-dva-provisioning-context';

function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  const builder = Object.assign(Promise.resolve(result), {
    eq: vi.fn(() => builder),
    in: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
  });
  return builder;
}

function client({
  settings = { paystack_enabled: true },
  transactions = [],
}: {
  settings?: unknown;
  transactions?: unknown[];
} = {}) {
  const settingsQuery = query(settings);
  const transactionsQuery = query(transactions);
  const paymentAccountQuery = query(null);
  return {
    accountQuery: paymentAccountQuery,
    from: vi.fn((table: string) => {
      if (table === 'merchant_feature_settings') return settingsQuery;
      if (table === 'transactions') return transactionsQuery;
      return paymentAccountQuery;
    }),
  };
}

const order = {
  amount_paid: 0,
  total: 10_000,
  wallet_amount_used: 0,
};

describe('loadDvaProvisioningContext', () => {
  it('rejects automatic confirmation when Paystack is disabled', async () => {
    const result = await loadDvaProvisioningContext({
      merchantId: 'merchant-1',
      order,
      orderId: 'order-1',
      supabase: client({ settings: { paystack_enabled: false } }) as never,
    });

    expect(result).toMatchObject({ code: 'GATEWAY_DISABLED', ok: false });
  });

  it('uses completed transactions and wallet funding to reconcile the balance', async () => {
    const supabase = client({
      transactions: [
        { amount: 2_000, gateway: 'paystack' },
        { amount: 1_000, gateway: 'wallet' },
      ],
    });
    const result = await loadDvaProvisioningContext({
      merchantId: 'merchant-1',
      order: { ...order, amount_paid: 1_000, wallet_amount_used: 3_000 },
      orderId: 'order-1',
      supabase: supabase as never,
    });

    expect(result).toEqual({ ok: true, payableAmount: 5_000 });
    expect(supabase.accountQuery.update).toHaveBeenCalledWith({
      payable_amount: 5_000,
    });
  });

  it('rejects provisioning when reconciled payments cover the order', async () => {
    const result = await loadDvaProvisioningContext({
      merchantId: 'merchant-1',
      order,
      orderId: 'order-1',
      supabase: client({
        transactions: [{ amount: 10_000, gateway: 'paystack' }],
      }) as never,
    });

    expect(result).toMatchObject({ code: 'NO_PAYABLE_AMOUNT', ok: false });
  });
});
