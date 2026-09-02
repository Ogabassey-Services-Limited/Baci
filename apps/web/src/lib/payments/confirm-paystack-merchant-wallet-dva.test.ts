import { beforeEach, describe, expect, it, vi } from 'vitest';

const { alias } = vi.hoisted(() => ({ alias: vi.fn() }));
vi.mock('@/lib/payments/paystack-dva-order-alias', () => ({
  hasActivePaystackOrderDvaAlias: alias,
}));

import { confirmPaystackMerchantWalletDva } from './confirm-paystack-merchant-wallet-dva';

function client(
  rows: unknown[],
  rpcResult: { data: unknown; error: Error | null } = {
    data: [{ new_balance: 1500, first_credit: true }],
    error: null,
  }
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const chain = {
    select: () => chain,
    eq: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: Supabase query mocks are thenable.
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: rows, error: null }),
  };
  return { from: () => chain, rpc } as unknown as Parameters<
    typeof confirmPaystackMerchantWalletDva
  >[0]['supabase'] & { rpc: typeof rpc };
}
const input = (
  supabase: Parameters<typeof confirmPaystackMerchantWalletDva>[0]['supabase'],
  extra: Partial<Parameters<typeof confirmPaystackMerchantWalletDva>[0]> = {}
) => ({
  supabase,
  accountNumber: '1234567890',
  gatewayReference: 'R1',
  verifiedAmount: { amount: 1500, currency: 'NGN' },
  paystackResponse: {},
  ...extra,
});
describe('verified merchant-wallet DVA credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alias.mockResolvedValue(false);
  });
  it('returns none for missing receiver', async () => {
    const s = client([{ merchant_id: 'm' }]);
    expect(
      (
        await confirmPaystackMerchantWalletDva(
          input(s, { accountNumber: null })
        )
      ).kind
    ).toBe('none');
  });
  it('returns none for missing amount or wrong currency', async () => {
    const s = client([{ merchant_id: 'm' }]);
    expect(
      (
        await confirmPaystackMerchantWalletDva(
          input(s, { verifiedAmount: null })
        )
      ).kind
    ).toBe('none');
    expect(
      (
        await confirmPaystackMerchantWalletDva(
          input(s, { verifiedAmount: { amount: 2, currency: 'USD' } })
        )
      ).kind
    ).toBe('none');
  });
  it('returns none for zero or negative amount', async () => {
    const s = client([{ merchant_id: 'm' }]);
    expect(
      (
        await confirmPaystackMerchantWalletDva(
          input(s, { verifiedAmount: { amount: 0, currency: 'NGN' } })
        )
      ).kind
    ).toBe('none');
    expect(
      (
        await confirmPaystackMerchantWalletDva(
          input(s, { verifiedAmount: { amount: -1, currency: 'NGN' } })
        )
      ).kind
    ).toBe('none');
  });
  it('returns none for no active account match', async () => {
    expect(
      (await confirmPaystackMerchantWalletDva(input(client([])))).kind
    ).toBe('none');
  });
  it('returns review for multiple active candidates', async () => {
    const result = await confirmPaystackMerchantWalletDva(
      input(client([{ merchant_id: 'm1' }, { merchant_id: 'm2' }]))
    );
    expect(result).toMatchObject({
      kind: 'review',
      status: 409,
      body: { code: 'MERCHANT_WALLET_DVA_AMBIGUOUS' },
    });
  });
  it('reviews an order-DVA alias before crediting', async () => {
    alias.mockResolvedValue(true);
    const s = client([{ merchant_id: 'm' }]);
    const result = await confirmPaystackMerchantWalletDva(input(s));
    expect(result).toMatchObject({
      kind: 'review',
      body: { code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT' },
    });
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it('falls back to the current time when paid_at is invalid before alias checks', async () => {
    const s = client([{ merchant_id: 'm' }]);
    const before = Date.now();
    await confirmPaystackMerchantWalletDva(
      input(s, { paystackResponse: { paid_at: 'not-a-date' } })
    );
    const aliasCall = alias.mock.calls.at(-1)?.[0] as { asOf: Date };
    expect(aliasCall.asOf).toBeInstanceOf(Date);
    expect(aliasCall.asOf.getTime()).toBeGreaterThanOrEqual(before);
    expect(Number.isNaN(aliasCall.asOf.getTime())).toBe(false);
  });
  it('credits exact active account and returns balance', async () => {
    const s = client([{ merchant_id: 'm' }]);
    const result = await confirmPaystackMerchantWalletDva(input(s));
    expect(result).toMatchObject({
      kind: 'match',
      balance: 1500,
      firstCredit: true,
    });
    expect(s.rpc).toHaveBeenCalledWith(
      'credit_merchant_wallet_funding',
      expect.objectContaining({
        p_amount: 1500,
        p_currency: 'NGN',
        p_reference: 'R1',
      })
    );
  });
  it('credits the full excess verified amount', async () => {
    const s = client([{ merchant_id: 'm' }]);
    await confirmPaystackMerchantWalletDva(
      input(s, { verifiedAmount: { amount: 9999, currency: 'NGN' } })
    );
    expect(s.rpc).toHaveBeenCalledWith(
      'credit_merchant_wallet_funding',
      expect.objectContaining({ p_amount: 9999 })
    );
  });
  it('returns a duplicate-safe firstCredit false result', async () => {
    const s = client([{ merchant_id: 'm' }], {
      data: [{ new_balance: 1500, first_credit: false }],
      error: null,
    });
    expect(await confirmPaystackMerchantWalletDva(input(s))).toMatchObject({
      kind: 'match',
      firstCredit: false,
    });
  });
  it('propagates credit RPC errors for webhook review handling', async () => {
    const s = client([{ merchant_id: 'm' }], {
      data: null,
      error: new Error('db secret'),
    });
    await expect(confirmPaystackMerchantWalletDva(input(s))).rejects.toThrow(
      'db secret'
    );
  });
  it('credits a reference once across duplicate confirmation calls', async () => {
    let balance = 0;
    let seen = false;
    const s = client([{ merchant_id: 'm' }]);
    s.rpc.mockImplementation(
      async (_name: string, args: { p_amount: number }) => {
        if (seen)
          return {
            data: [{ new_balance: balance, first_credit: false }],
            error: null,
          };
        seen = true;
        balance += args.p_amount;
        return {
          data: [{ new_balance: balance, first_credit: true }],
          error: null,
        };
      }
    );
    const first = await confirmPaystackMerchantWalletDva(
      input(s, { verifiedAmount: { amount: 9999, currency: 'NGN' } })
    );
    const second = await confirmPaystackMerchantWalletDva(
      input(s, { verifiedAmount: { amount: 9999, currency: 'NGN' } })
    );
    expect(first).toMatchObject({
      kind: 'match',
      balance: 9999,
      firstCredit: true,
    });
    expect(second).toMatchObject({
      kind: 'match',
      balance: 9999,
      firstCredit: false,
    });
    expect(balance).toBe(9999);
    expect(s.rpc).toHaveBeenCalledTimes(2);
  });
});
