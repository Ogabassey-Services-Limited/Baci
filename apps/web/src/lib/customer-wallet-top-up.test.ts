import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { creditWalletTopUp } from '@/lib/customer-wallet-top-up';

function createWalletCreditSupabaseMock({
  existingCredit,
  rpcResult,
}: {
  existingCredit: {
    balance_after: number | string;
    id: string;
  } | null;
  rpcResult?: unknown;
}) {
  const query: Record<string, unknown> = {};
  const select = vi.fn(() => query);
  const eq = vi.fn(() => query);
  const order = vi.fn(() => query);
  const limit = vi.fn(() => query);
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingCredit,
    error: null,
  });
  Object.assign(query, { eq, limit, maybeSingle, order, select });

  const rpc = vi.fn().mockResolvedValue({
    data: rpcResult ?? [
      {
        new_balance: '2250',
        success: true,
        transaction_id: 'wallet-credit-2',
      },
    ],
    error: null,
  });
  const from = vi.fn(() => query);

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
  };
}

const walletTopUpInput = {
  amount: 1500,
  customerId: 'customer-1',
  gateway: 'paystack',
  merchantId: 'merchant-1',
  reference: 'WAL-123',
  transactionId: 'payment-tx-1',
};

describe('creditWalletTopUp', () => {
  it('returns an existing wallet credit without calling the RPC again', async () => {
    const { client, rpc } = createWalletCreditSupabaseMock({
      existingCredit: {
        balance_after: '1250.75',
        id: 'wallet-credit-1',
      },
    });

    await expect(
      creditWalletTopUp({ ...walletTopUpInput, supabase: client })
    ).resolves.toEqual({
      balance: 1250.75,
      reference: 'WAL-123',
      transactionId: 'wallet-credit-1',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('credits the wallet through the idempotent RPC when no credit exists', async () => {
    const { client, rpc } = createWalletCreditSupabaseMock({
      existingCredit: null,
    });

    await expect(
      creditWalletTopUp({ ...walletTopUpInput, supabase: client })
    ).resolves.toEqual({
      balance: 2250,
      reference: 'WAL-123',
      transactionId: 'wallet-credit-2',
    });
    expect(rpc).toHaveBeenCalledWith('credit_customer_wallet', {
      p_amount: 1500,
      p_customer_id: 'customer-1',
      p_description: 'Wallet top-up via paystack',
      p_merchant_id: 'merchant-1',
      p_source_id: 'payment-tx-1',
      p_source_type: 'wallet_topup',
    });
  });

  it('rejects invalid amounts before querying Supabase', async () => {
    const { client, from, rpc } = createWalletCreditSupabaseMock({
      existingCredit: null,
    });

    await expect(
      creditWalletTopUp({
        ...walletTopUpInput,
        amount: Number.NaN,
        supabase: client,
      })
    ).rejects.toThrow('Top-up amount must be positive');
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
