import { describe, expect, it } from 'vitest';
import { normalizeAgenticPaystackDvaTransaction } from '@/lib/agentic/paystack-dva-transaction';

describe('normalizeAgenticPaystackDvaTransaction', () => {
  it('coerces numeric strings for webhook processing', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: '100.00',
      currency: 'NGN',
      gateway_fee: '1.50',
      id: 'txn-1',
      merchant_id: 'merchant-1',
      metadata: { transaction_type: 'agentic_checkout_payment' },
      order_id: 'order-1',
      platform_fee: '2.00',
    });

    expect(transaction).toEqual({
      amount: 100,
      currency: 'NGN',
      gateway_fee: 1.5,
      id: 'txn-1',
      merchant_id: 'merchant-1',
      metadata: { transaction_type: 'agentic_checkout_payment' },
      order_id: 'order-1',
      platform_fee: 2,
    });
  });

  it('preserves zero amounts and treats missing metadata as null', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: 0,
      currency: 'NGN',
      gateway_fee: undefined,
      id: 'txn-2',
      merchant_id: 'merchant-1',
      order_id: null,
      platform_fee: '0',
    });

    expect(transaction).toEqual({
      amount: 0,
      currency: 'NGN',
      gateway_fee: null,
      id: 'txn-2',
      merchant_id: 'merchant-1',
      metadata: null,
      order_id: null,
      platform_fee: 0,
    });
  });

  it('preserves alternate transaction metadata for generic webhook handling', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: '25',
      currency: 'NGN',
      id: 'txn-3',
      merchant_id: 'merchant-1',
      metadata: { transaction_type: 'wallet_top_up' },
    });

    expect(transaction.metadata).toEqual({ transaction_type: 'wallet_top_up' });
  });

  it('coerces invalid money values to null', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: 'not-a-number',
      currency: 'NGN',
      gateway_fee: Number.NaN,
      id: 'txn-4',
      merchant_id: 'merchant-1',
      platform_fee: '',
    });

    expect(transaction.amount).toBeNull();
    expect(transaction.gateway_fee).toBeNull();
    expect(transaction.platform_fee).toBeNull();
  });

  it('rejects transaction rows without required identifiers', () => {
    expect(() =>
      normalizeAgenticPaystackDvaTransaction({
        amount: '25',
        currency: 'NGN',
        merchant_id: 'merchant-1',
      })
    ).toThrow('Missing transaction id');
  });
});
