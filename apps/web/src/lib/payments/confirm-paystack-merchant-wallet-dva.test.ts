import { describe, expect, it, vi } from 'vitest';
import { confirmPaystackMerchantWalletDva } from './confirm-paystack-merchant-wallet-dva';

function client(rows: unknown[]) {
  const chain: Record<string, any> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
  // biome-ignore lint/suspicious/noThenProperty: Supabase query mocks are thenable.
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: rows, error: null });
  chain.from = () => chain;
  chain.rpc = vi.fn().mockResolvedValue({
    data: [{ new_balance: 1500, first_credit: true }],
    error: null,
  });
  return chain;
}

describe('merchant wallet DVA confirmation', () => {
  it('credits an exact active account match', async () => {
    const result = await confirmPaystackMerchantWalletDva({
      supabase: client([{ merchant_id: 'm1' }]) as any,
      accountNumber: '1234567890',
      gatewayReference: 'R1',
      verifiedAmount: { amount: 1500, currency: 'NGN' },
      paystackResponse: {},
    });
    expect(result).toMatchObject({ kind: 'match', balance: 1500 });
  });
  it('rejects zero amount without credit', async () => {
    const supabase = client([{ merchant_id: 'm1' }]);
    expect(
      (
        await confirmPaystackMerchantWalletDva({
          supabase: supabase as any,
          accountNumber: '1234567890',
          gatewayReference: 'R1',
          verifiedAmount: { amount: 0, currency: 'NGN' },
          paystackResponse: {},
        })
      ).kind
    ).toBe('none');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
