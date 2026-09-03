import { beforeEach, describe, expect, it, vi } from 'vitest';

const { customer, accounts, createServiceClient } = vi.hoisted(() => ({
  customer: vi.fn(),
  accounts: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  createOrGetCustomer: customer,
  getDedicatedAccounts: accounts,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient,
}));

import {
  pickRecoverableFundingAccount,
  resumeMerchantWalletFundingRequest,
} from './resume-merchant-wallet-funding-request';

type ResumeClient = Parameters<typeof resumeMerchantWalletFundingRequest>[0] & {
  rpc: ReturnType<typeof vi.fn>;
};

function supabase(rpcData: unknown = null): ResumeClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
  } as unknown as ResumeClient;
}

function dva(overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    assigned: true,
    currency: 'NGN',
    account_number: '1234567890',
    account_name: 'Wallet',
    bank: { name: 'Wema', id: 1, slug: 'wema-bank' },
    id: 9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    customer: {
      id: 1,
      email: 'e@example.com',
      customer_code: 'CUS_1',
      first_name: null,
      last_name: null,
    },
    metadata: null,
    ...overrides,
  };
}

describe('pickRecoverableFundingAccount', () => {
  it('requires exactly one request-correlated active NGN account', () => {
    const requestCreated = new Date('2026-09-03T10:00:00.000Z').toISOString();
    expect(
      pickRecoverableFundingAccount(
        [
          dva({
            account_number: '1111111111',
            created_at: '2026-09-01T00:00:00.000Z',
          }),
          dva({
            account_number: '1234567890',
            created_at: '2026-09-03T10:01:00.000Z',
          }),
        ],
        { id: 'r1', created_at: requestCreated }
      )?.account_number
    ).toBe('1234567890');
  });

  it('rejects an older unrelated DVA even when it is the only active account', () => {
    expect(
      pickRecoverableFundingAccount(
        [
          dva({
            created_at: '2026-08-01T00:00:00.000Z',
          }),
        ],
        {
          id: 'r1',
          created_at: new Date('2026-09-03T10:00:00.000Z').toISOString(),
        }
      )
    ).toBeNull();
  });
});

describe('resumeMerchantWalletFundingRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customer.mockResolvedValue({
      success: true,
      data: { customer_code: 'CUS_1' },
    });
    accounts.mockResolvedValue({ success: true, data: [] });
    createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { account_name: 'Wallet', bank_name: 'Wema' },
        error: null,
      }),
    });
  });

  it('completes a pending request when Paystack already assigned a correlated DVA', async () => {
    const createdAt = new Date().toISOString();
    accounts.mockResolvedValue({
      success: true,
      data: [dva({ created_at: createdAt })],
    });
    const assignmentRpc = vi.fn().mockResolvedValue({
      data: { account_name: 'Wallet', bank_name: 'Wema' },
      error: null,
    });
    createServiceClient.mockReturnValue({ rpc: assignmentRpc });
    const client = supabase();

    await expect(
      resumeMerchantWalletFundingRequest(
        client,
        { id: 'm', email: 'e' },
        { id: 'r1', created_at: createdAt }
      )
    ).resolves.toMatchObject({
      status: 'active',
      account: { accountNumber: '1234567890', status: 'active' },
    });
    expect(assignmentRpc).toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.objectContaining({
        p_request_id: 'r1',
        p_account_number: '1234567890',
      })
    );
    expect(client.rpc).not.toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.anything()
    );
  });

  it('keeps the request pending when Paystack listing fails instead of expiring it', async () => {
    accounts.mockResolvedValue({
      success: false,
      error: 'timeout',
      code: 'NETWORK_ERROR',
    });
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
    ).resolves.toEqual({
      status: 'pending',
      account: null,
      requestId: 'r1',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('expires a stale pending request only after an authoritative empty listing', async () => {
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
