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
  requestMerchantWalletAccount,
} from './merchant-wallet-payment-accounts';
import { persistMerchantWalletAssignmentEvent } from './persist-merchant-wallet-assignment-event';

type Row = Record<string, unknown>;
function client(
  rows: Row[] = [],
  options: {
    assignmentExisting?: Row | null;
    assignmentExistingError?: Error | null;
    assignmentRequestError?: Error | null;
    assignmentRequestRows?: Row[];
    assignmentRequestSingle?: Row | null;
    insertError?: Error;
    rpcError?: Error;
  } = {}
) {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: null, error: options.rpcError ?? null });
  const accountChain: Record<string, unknown> = {};
  const requestChain: Record<string, unknown> = {};
  let maybeCalls = 0;
  let requestUpdateCalls = 0;
  const requestStatusFilters: unknown[] = [];
  let requestRowsForQuery = options.assignmentRequestRows ?? [];
  for (const chain of [accountChain, requestChain]) {
    chain.select = () => chain;
    chain.eq = () => chain;
  }
  accountChain.in = () => accountChain;
  requestChain.in = (_column: unknown, values: unknown) => {
    requestStatusFilters.push(values);
    const allowedStatuses = Array.isArray(values) ? values : [];
    requestRowsForQuery = (options.assignmentRequestRows ?? []).filter((row) =>
      allowedStatuses.includes(row.status)
    );
    return requestChain;
  };
  accountChain.maybeSingle = async () => ({
    data:
      options.insertError && ++maybeCalls > 1
        ? { id: 'pending' }
        : (options.assignmentExisting ?? rows[0] ?? null),
    error: options.assignmentExistingError ?? null,
  });
  requestChain.maybeSingle = async () => ({
    data: requestUpdateCalls
      ? { id: 'r', status: 'failed' }
      : (options.assignmentRequestSingle ??
        options.assignmentRequestRows?.[0] ??
        (options.insertError ? { id: 'pending' } : null)),
    error: options.assignmentRequestError ?? null,
  });
  // biome-ignore lint/suspicious/noThenProperty: Supabase query mocks are thenable.
  requestChain.then = (resolve: (value: unknown) => unknown) =>
    resolve({
      data: requestRowsForQuery,
      error: options.assignmentRequestError ?? null,
    });
  requestChain.update = () => {
    requestUpdateCalls += 1;
    return requestChain;
  };
  requestChain.insert = () => requestChain;
  requestChain.single = async () => ({
    data: { id: 'req1', status: 'pending' },
    error: options.insertError ?? null,
  });
  return {
    from: (table: string) =>
      table === 'merchant_wallet_funding_account_requests'
        ? requestChain
        : accountChain,
    rpc,
    chain: accountChain,
    getRequestUpdateCalls: () => requestUpdateCalls,
    getRequestStatusFilters: () => requestStatusFilters,
  } as unknown as Parameters<typeof getMerchantWalletAccount>[0] & {
    getRequestStatusFilters: () => unknown[];
  };
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
  it('marks the request failed when customer provisioning throws', async () => {
    customer.mockRejectedValue(new Error('provider timeout'));
    const supabase = client();
    await expect(
      requestMerchantWalletAccount(supabase, { id: 'm', email: 'e' })
    ).rejects.toThrow('Paystack customer provisioning failed');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'fail_merchant_wallet_funding_request',
      { p_request_id: 'req1', p_merchant_id: 'm' }
    );
  });
  it('requires review when the failure transition itself fails', async () => {
    customer.mockRejectedValue(new Error('provider timeout'));
    const supabase = client([], { rpcError: new Error('rpc down') });
    await expect(
      requestMerchantWalletAccount(supabase, { id: 'm', email: 'e' })
    ).rejects.toThrow('FUNDING_REQUEST_REVIEW_REQUIRED');
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
    const supabase = client();
    await expect(
      requestMerchantWalletAccount(supabase, { id: 'm', email: 'e' })
    ).rejects.toThrow('Paystack DVA provisioning failed');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'fail_merchant_wallet_funding_request',
      { p_request_id: 'req1', p_merchant_id: 'm' }
    );
  });
  it('marks the request failed when DVA provisioning throws', async () => {
    dva.mockRejectedValue(new Error('provider timeout'));
    const supabase = client();
    await expect(
      requestMerchantWalletAccount(supabase, { id: 'm', email: 'e' })
    ).rejects.toThrow('Paystack DVA provisioning failed');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'fail_merchant_wallet_funding_request',
      { p_request_id: 'req1', p_merchant_id: 'm' }
    );
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
  it.each([
    { active: false },
    { assigned: false },
  ])('reviews provider assignments with flags %j', async (flags) => {
    const supabase = client([], {
      assignmentRequestRows: [{ id: 'r', merchant_id: 'm', status: 'pending' }],
    });
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        currency: 'NGN',
        ...flags,
      },
    };

    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('review');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('invokes persist RPC for a valid assignment event', async () => {
    const supabase = client([], {
      assignmentRequestRows: [{ id: 'r', merchant_id: 'm', status: 'pending' }],
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
        bank: { name: 'B' },
      },
    };
    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('match');
    expect(supabase.getRequestStatusFilters()).toEqual([
      ['pending', 'fulfilled'],
    ]);
  });
  it('prefers customer funding metadata when a direct source belongs to another flow', async () => {
    const supabase = client([], {
      assignmentRequestRows: [{ id: 'r', merchant_id: 'm', status: 'pending' }],
    });
    const payload = {
      data: {
        metadata: {
          source: 'other',
          request_id: 'wrong',
          merchant_id: 'wrong',
        },
        customer: {
          metadata: {
            source: 'merchant_wallet_funding',
            request_id: 'r',
            merchant_id: 'm',
          },
        },
        account_number: '1234567890',
        currency: 'NGN',
      },
    };

    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('match');
  });
  it('treats an exact fulfilled replay as success without rewriting the account', async () => {
    const supabase = client([], {
      assignmentRequestRows: [
        { id: 'r', merchant_id: 'm', status: 'fulfilled' },
      ],
      assignmentExisting: {
        account_number: '1234567890',
        account_name: 'A',
        bank_name: null,
        currency: 'NGN',
        provider_account_id: null,
        provider_customer_code: null,
      },
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
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('reviews a fulfilled replay when the existing account lookup fails', async () => {
    const supabase = client([], {
      assignmentRequestRows: [
        { id: 'r', merchant_id: 'm', status: 'fulfilled' },
      ],
      assignmentExistingError: new Error('account lookup failed'),
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
    ).toBe('review');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('reviews a conflicting fulfilled replay without rewriting the account', async () => {
    const supabase = client([], {
      assignmentRequestRows: [
        { id: 'r', merchant_id: 'm', status: 'fulfilled' },
      ],
      assignmentExisting: {
        account_number: '1234567890',
        account_name: 'Original',
        bank_name: null,
        currency: 'NGN',
        provider_account_id: null,
        provider_customer_code: null,
      },
    });
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
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.getRequestStatusFilters()).toEqual([
      ['pending', 'fulfilled'],
    ]);
  });
  it.each([
    { assignmentRequestRows: [] },
    {
      assignmentRequestRows: [{ id: 'r', merchant_id: 'm', status: 'failed' }],
    },
  ])('reviews an inactive or unassigned funding request', async (options) => {
    const supabase = client([], options);
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        currency: 'NGN',
      },
    };

    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('review');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.getRequestStatusFilters()).toEqual([
      ['pending', 'fulfilled'],
    ]);
  });
  it('fails the pending request when assignment hits PAYSTACK_DVA_ALIAS_CONFLICT', async () => {
    const supabase = client([], {
      assignmentRequestRows: [{ id: 'r', merchant_id: 'm', status: 'pending' }],
    });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'PAYSTACK_DVA_ALIAS_CONFLICT' },
      })
      .mockResolvedValueOnce({ data: null, error: null });
    (supabase as { rpc: typeof rpc }).rpc = rpc;
    const payload = {
      data: {
        metadata: {
          source: 'merchant_wallet_funding',
          request_id: 'r',
          merchant_id: 'm',
        },
        account_number: '1234567890',
        currency: 'NGN',
      },
    };

    expect(
      (await persistMerchantWalletAssignmentEvent(supabase, payload)).kind
    ).toBe('conflict');
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'reject_merchant_wallet_funding_alias_conflict',
      {
        p_request_id: 'r',
        p_merchant_id: 'm',
        p_account_number: '1234567890',
      }
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
