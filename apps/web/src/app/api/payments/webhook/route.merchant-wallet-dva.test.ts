import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistMerchantWalletAssignmentEvent } from '@/lib/merchant-wallet-payment-accounts';

function supabase(error: Error | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { rpc } as Parameters<
    typeof persistMerchantWalletAssignmentEvent
  >[0] & { rpc: typeof rpc };
}
const valid = (overrides: Record<string, unknown> = {}) => ({
  data: {
    metadata: {
      source: 'merchant_wallet_funding',
      request_id: 'req-1',
      merchant_id: 'm-1',
    },
    account_number: '1234567890',
    account_name: 'Merchant',
    currency: 'NGN',
    bank: { name: 'Bank' },
    ...overrides,
  },
});
describe('verified Paystack merchant-wallet assignment events', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('reviews missing payload data', async () => {
    expect(
      (await persistMerchantWalletAssignmentEvent(supabase(), {})).kind
    ).toBe('review');
  });
  it('reviews unknown source metadata', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(),
          valid({
            metadata: {
              source: 'order_dva',
              request_id: 'r',
              merchant_id: 'm',
            },
          })
        )
      ).kind
    ).toBe('review');
  });
  it('reviews absent request correlation', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(),
          valid({
            metadata: { source: 'merchant_wallet_funding', merchant_id: 'm' },
          })
        )
      ).kind
    ).toBe('review');
  });
  it('reviews absent merchant correlation', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(),
          valid({
            metadata: { source: 'merchant_wallet_funding', request_id: 'r' },
          })
        )
      ).kind
    ).toBe('review');
  });
  it('reviews non-NGN accounts', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(),
          valid({ currency: 'USD' })
        )
      ).kind
    ).toBe('review');
  });
  it('reviews malformed account numbers', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(),
          valid({ account_number: 'ABC' })
        )
      ).kind
    ).toBe('review');
  });
  it('persists valid assignments through the service RPC seam', async () => {
    const s = supabase();
    expect((await persistMerchantWalletAssignmentEvent(s, valid())).kind).toBe(
      'match'
    );
    expect(s.rpc).toHaveBeenCalledWith(
      'persist_merchant_wallet_payment_account',
      expect.objectContaining({
        p_request_id: 'req-1',
        p_merchant_id: 'm-1',
        p_currency: 'NGN',
      })
    );
  });
  it('always invokes persistence for valid duplicate-shaped events', async () => {
    const s = supabase();
    await persistMerchantWalletAssignmentEvent(s, valid({ id: 'same' }));
    await persistMerchantWalletAssignmentEvent(s, valid({ id: 'same' }));
    expect(s.rpc).toHaveBeenCalledTimes(2);
  });
  it('maps persistence conflicts or provider errors to review', async () => {
    expect(
      (
        await persistMerchantWalletAssignmentEvent(
          supabase(new Error('conflict')),
          valid()
        )
      ).kind
    ).toBe('review');
  });
  it('does not expose provider account payload in its result', async () => {
    const result = await persistMerchantWalletAssignmentEvent(
      supabase(),
      valid({ account_number: '1234567890', account_name: 'Secret' })
    );
    expect(result).toEqual({ kind: 'match' });
  });
});
