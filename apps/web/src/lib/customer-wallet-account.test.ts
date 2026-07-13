import { describe, expect, it, vi } from 'vitest';
import { creditUsdtWalletTopUp } from './customer-wallet-account';

describe('creditUsdtWalletTopUp', () => {
  it('credits the USDT account through the service-role-only currency RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          currency: 'USDT',
          new_balance: '25.000000',
          success: true,
          transaction_id: 'ledger-1',
        },
      ],
      error: null,
    });

    await expect(
      creditUsdtWalletTopUp({
        amount: 25,
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        reference: 'WUSDT-1',
        supabase: { rpc } as never,
        transactionId: '11111111-1111-4111-8111-111111111111',
      })
    ).resolves.toEqual({
      balance: 25,
      currency: 'USDT',
      reference: 'WUSDT-1',
      transactionId: 'ledger-1',
    });
    expect(rpc).toHaveBeenCalledWith('credit_customer_wallet_account', {
      p_amount: 25,
      p_currency: 'USDT',
      p_customer_id: 'customer-1',
      p_description: 'USDT wallet top-up via Juicyway',
      p_merchant_id: 'merchant-1',
      p_source_id: '11111111-1111-4111-8111-111111111111',
      p_source_type: 'wallet_usdt_topup',
    });
  });

  it('rejects non-positive credits before touching the ledger', async () => {
    const rpc = vi.fn();
    await expect(
      creditUsdtWalletTopUp({
        amount: 0,
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        reference: 'WUSDT-1',
        supabase: { rpc } as never,
        transactionId: '11111111-1111-4111-8111-111111111111',
      })
    ).rejects.toThrow('positive');
    expect(rpc).not.toHaveBeenCalled();
  });
});
