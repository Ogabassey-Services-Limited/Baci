import { beforeEach, describe, expect, it, vi } from 'vitest';

const { customer, dva } = vi.hoisted(() => ({
  customer: vi.fn(),
  dva: vi.fn(),
}));
vi.mock('@/lib/paystack', () => ({
  createOrGetCustomer: customer,
  createDedicatedAccount: dva,
}));

import {
  getMerchantWalletAccount,
  persistMerchantWalletAssignmentEvent,
  requestMerchantWalletAccount,
} from './merchant-wallet-payment-accounts';

type Row = Record<string, unknown>;
function client(
  rows: Row[] = [],
  options: { insertError?: Error; rpcError?: Error } = {}
) {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: null, error: options.rpcError ?? null });
  const chain: Record<string, unknown> = {};
  let maybeCalls = 0;
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.maybeSingle = async () => ({
    data:
      options.insertError && ++maybeCalls > 1
        ? { id: 'pending' }
        : (rows[0] ?? null),
    error: null,
  });
  chain.insert = () => chain;
  chain.single = async () => ({
    data: { id: 'req1', status: 'pending' },
    error: options.insertError ?? null,
  });
  chain.rpc = rpc;
  return { from: () => chain, rpc, chain } as unknown as Parameters<
    typeof getMerchantWalletAccount
  >[0];
}
describe('merchant wallet payment-account provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customer.mockResolvedValue({
      success: true,
      data: { customer_code: 'CUS' },
    });
    dva.mockResolvedValue({ success: true, data: { id: 'DVA' } });
  });
  it('returns null when no active or pending account exists', async () => {
    expect(await getMerchantWalletAccount(client(), 'm')).toBeNull();
  });
  it('maps only safe account fields', async () => {
    const account = await getMerchantWalletAccount(
      client([
        {
          account_name: 'A',
          account_number: '1234567890',
          bank_name: 'B',
          status: 'active',
        },
      ]),
      'm'
    );
    expect(account).toEqual({
      accountName: 'A',
      accountNumber: '1234567890',
      bankName: 'B',
      currency: 'NGN',
      status: 'active',
    });
  });
  it('reuses an existing active account without provider calls', async () => {
    const result = await requestMerchantWalletAccount(
      client([
        {
          account_name: 'A',
          account_number: '1234567890',
          bank_name: 'B',
          status: 'active',
        },
      ]),
      { id: 'm', email: 'e' }
    );
    expect(result.status).toBe('active');
    expect(customer).not.toHaveBeenCalled();
  });
  it('persists request before customer provisioning', async () => {
    const result = await requestMerchantWalletAccount(client(), {
      id: 'm',
      email: 'e',
    });
    expect(result.status).toBe('pending');
    expect(customer).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          request_id: 'req1',
          merchant_id: 'm',
          source: 'merchant_wallet_funding',
        }),
      })
    );
  });
  it('reuses a pending request after duplicate insert', async () => {
    const result = await requestMerchantWalletAccount(
      client([], { insertError: new Error('duplicate') }),
      { id: 'm', email: 'e' }
    );
    expect(result).toEqual({ status: 'pending', account: null });
  });
  it('fails safely when customer provisioning fails', async () => {
    customer.mockResolvedValue({ success: false });
    await expect(
      requestMerchantWalletAccount(client(), { id: 'm', email: 'e' })
    ).rejects.toThrow('Paystack customer provisioning failed');
  });
  it('surfaces review when failed transition RPC fails', async () => {
    customer.mockResolvedValue({ success: false });
    await expect(
      requestMerchantWalletAccount(client([], { rpcError: new Error('rpc') }), {
        id: 'm',
        email: 'e',
      })
    ).rejects.toThrow('FUNDING_REQUEST_REVIEW_REQUIRED');
  });
  it('fails safely when DVA provisioning fails', async () => {
    dva.mockResolvedValue({ success: false });
    await expect(
      requestMerchantWalletAccount(client(), { id: 'm', email: 'e' })
    ).rejects.toThrow('Paystack DVA provisioning failed');
  });
  it.each([
    {},
    { data: {} },
  ])('reviews assignment metadata without an explicit source', async (payload) => {
    expect(
      (await persistMerchantWalletAssignmentEvent(client(), payload)).kind
    ).toBe('review');
  });
  it('ignores assignment metadata from another source', async () => {
    const payload = { data: { metadata: { source: 'other' } } };
    expect(
      (await persistMerchantWalletAssignmentEvent(client(), payload)).kind
    ).toBe('ignored');
  });
  it('reviews wallet assignment metadata missing merchant correlation', async () => {
    const payload = {
      data: {
        metadata: { source: 'merchant_wallet_funding', request_id: 'r' },
      },
    };
    expect(
      (await persistMerchantWalletAssignmentEvent(client(), payload)).kind
    ).toBe('review');
  });
  it('reviews malformed account number and wrong currency', async () => {
    const base = {
      metadata: {
        source: 'merchant_wallet_funding',
        request_id: 'r',
        merchant_id: 'm',
      },
    };
    expect(
      (
        await persistMerchantWalletAssignmentEvent(client(), {
          data: { metadata: base, account_number: '12', currency: 'NGN' },
        })
      ).kind
    ).toBe('review');
    expect(
      (
        await persistMerchantWalletAssignmentEvent(client(), {
          data: {
            metadata: base,
            account_number: '1234567890',
            currency: 'USD',
          },
        })
      ).kind
    ).toBe('review');
  });
  it('invokes persist RPC for a valid assignment event', async () => {
    const supabase = client();
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        account_name: 'A',
        currency: 'NGN',
        bank: { name: 'B' },
      },
    };
    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('match');
  });
  it('treats an exact fulfilled replay as success through the locked RPC', async () => {
    const supabase = client();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'account-1' }],
      error: null,
    });
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        account_name: 'A',
        currency: 'NGN',
      },
    };
    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('match');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.anything()
    );
  });
  it('reviews a conflicting fulfilled replay while calling the same RPC', async () => {
    const supabase = client();
    (supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('conflicting_assignment_replay')
    );
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        account_name: 'Changed',
        currency: 'NGN',
      },
    };
    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('review');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.anything()
    );
  });
  it('allows a later retry after a provider failure is transitioned to failed', async () => {
    customer.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({
      success: true,
      data: { customer_code: 'CUS2' },
    });
    const first = await expect(
      requestMerchantWalletAccount(client(), { id: 'm1', email: 'e' })
    ).rejects.toThrow('Paystack customer provisioning failed');
    expect(first).toBeDefined();
    const second = await requestMerchantWalletAccount(client(), {
      id: 'm1',
      email: 'e',
    });
    expect(second.status).toBe('pending');
    expect(dva).toHaveBeenCalledTimes(1);
  });
});
