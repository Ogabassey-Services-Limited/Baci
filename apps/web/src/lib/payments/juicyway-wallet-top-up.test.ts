import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ credit: vi.fn() }));
vi.mock('@/lib/customer-wallet-account', () => ({
  creditUsdtWalletTopUp: mocks.credit,
  USDT_WALLET_TOP_UP_TRANSACTION_TYPE: 'wallet_usdt_topup',
}));

import { handleJuicywayWalletTopUpIfNeeded } from './juicyway-wallet-top-up';

function transaction(status = 'pending') {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    merchant_id: 'merchant-1',
    metadata: {
      customer_id: 'customer-1',
      juicyway_expected_amount: 2500,
      juicyway_expected_currency: 'USDT',
      transaction_type: 'wallet_usdt_topup',
      wallet_credit_amount: 25,
    },
    status,
  };
}

describe('handleJuicywayWalletTopUpIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credit.mockResolvedValue({
      balance: 25,
      currency: 'USDT',
      reference: 'WUSDT-1',
      transactionId: 'ledger-1',
    });
  });

  it('credits exactly the locked wallet amount and then completes the transaction', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const supabase = { from: vi.fn(() => ({ update })) } as never;

    const response = await handleJuicywayWalletTopUpIfNeeded({
      payment: { amount: 2500, currency: 'USDT' },
      reference: 'WUSDT-1',
      supabase,
      transaction: transaction(),
    });

    expect(response?.status).toBe(200);
    expect(mocks.credit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25 })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('rejects a wrong-currency or underpaid settlement without crediting', async () => {
    const response = await handleJuicywayWalletTopUpIfNeeded({
      payment: { amount: 2400, currency: 'USDC' },
      reference: 'WUSDT-1',
      supabase: {} as never,
      transaction: transaction(),
    });

    expect(response?.status).toBe(400);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it('rejects a same-currency settlement below the exact expected amount', async () => {
    const response = await handleJuicywayWalletTopUpIfNeeded({
      payment: { amount: 2499, currency: 'USDT' },
      reference: 'WUSDT-1',
      supabase: {} as never,
      transaction: transaction(),
    });

    expect(response?.status).toBe(400);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it('returns null for an ordinary Juicyway order transaction', async () => {
    const response = await handleJuicywayWalletTopUpIfNeeded({
      payment: { amount: 2500, currency: 'USDT' },
      reference: 'order-1',
      supabase: {} as never,
      transaction: {
        ...transaction(),
        metadata: { transaction_type: 'order' },
      },
    });

    expect(response).toBeNull();
  });
});
