import { beforeEach, describe, expect, it, vi } from 'vitest';

const { customer, accounts } = vi.hoisted(() => ({
  customer: vi.fn(),
  accounts: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  createOrGetCustomer: customer,
  getDedicatedAccounts: accounts,
}));

import { resumeMerchantWalletFundingRequest } from './resume-merchant-wallet-funding-request';

function supabase(rpcData: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
  } as never;
}

describe('resumeMerchantWalletFundingRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customer.mockResolvedValue({
      success: true,
      data: { customer_code: 'CUS_1' },
    });
    accounts.mockResolvedValue({ success: true, data: [] });
  });

  it('completes a pending request when Paystack already assigned the DVA', async () => {
    accounts.mockResolvedValue({
      success: true,
      data: [
        {
          active: true,
          assigned: true,
          currency: 'NGN',
          account_number: '1234567890',
          account_name: 'Wallet',
          bank: { name: 'Wema' },
          id: 9,
          customer: { customer_code: 'CUS_1' },
        },
      ],
    });
    const client = supabase({
      account_name: 'Wallet',
      bank_name: 'Wema',
    });

    await expect(
      resumeMerchantWalletFundingRequest(
        client,
        { id: 'm', email: 'e' },
        {
          id: 'r1',
          created_at: new Date().toISOString(),
        }
      )
    ).resolves.toMatchObject({
      status: 'active',
      account: { accountNumber: '1234567890', status: 'active' },
    });
    expect(client.rpc).toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.objectContaining({
        p_request_id: 'r1',
        p_account_number: '1234567890',
      })
    );
  });

  it('expires a stale pending request with no Paystack account so consent can retry', async () => {
    const client = supabase();
    await expect(
      resumeMerchantWalletFundingRequest(
        client,
        { id: 'm', email: 'e' },
        {
          id: 'r1',
          created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        }
      )
    ).rejects.toThrow('FUNDING_REQUEST_EXPIRED_RETRY');
    expect(client.rpc).toHaveBeenCalledWith(
      'fail_merchant_wallet_funding_request',
      { p_request_id: 'r1', p_merchant_id: 'm' }
    );
  });
});
