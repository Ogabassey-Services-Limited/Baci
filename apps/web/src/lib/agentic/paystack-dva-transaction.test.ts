import { describe, expect, it } from 'vitest';
import {
  AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT,
  normalizeAgenticPaystackDvaTransaction,
} from '@/lib/agentic/paystack-dva-transaction';

describe('AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT', () => {
  // Δ-0a / Δ-27: the live `transactions` table has NO `gateway_fee` column;
  // PR #308 added it to the SELECT in 2026-02-20 and 400'd every Paystack
  // DVA webhook since. Settlement also needs `gateway_reference` so it can
  // pass the canonical BAC-* key (Δ-22 invariant).
  const columns = AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT.split(',').map((c) =>
    c.trim()
  );

  it('does not select the non-existent gateway_fee column', () => {
    expect(columns).not.toContain('gateway_fee');
  });

  it('selects gateway_reference so settlement can pass the BAC-* key', () => {
    expect(columns).toContain('gateway_reference');
  });

  it('selects exactly the columns the webhook + settlement need', () => {
    expect(columns.sort()).toEqual(
      [
        'id',
        'amount',
        'currency',
        'merchant_id',
        'metadata',
        'order_id',
        'platform_fee',
        'gateway_reference',
      ].sort()
    );
  });
});

describe('normalizeAgenticPaystackDvaTransaction', () => {
  it('coerces numeric strings for webhook processing', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: '100.00',
      currency: 'NGN',
      gateway_reference: 'BAC-7TUD6N4WJCNM',
      id: 'txn-1',
      merchant_id: 'merchant-1',
      metadata: { transaction_type: 'agentic_checkout_payment' },
      order_id: 'order-1',
      platform_fee: '2.00',
    });

    expect(transaction).toEqual({
      amount: 100,
      currency: 'NGN',
      gateway_reference: 'BAC-7TUD6N4WJCNM',
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
      gateway_reference: null,
      id: 'txn-2',
      merchant_id: 'merchant-1',
      order_id: null,
      platform_fee: '0',
    });

    expect(transaction).toEqual({
      amount: 0,
      currency: 'NGN',
      gateway_reference: null,
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

  it('coerces invalid money values to null and missing reference to null', () => {
    const transaction = normalizeAgenticPaystackDvaTransaction({
      amount: 'not-a-number',
      currency: 'NGN',
      id: 'txn-4',
      merchant_id: 'merchant-1',
      platform_fee: '',
    });

    expect(transaction.amount).toBeNull();
    expect(transaction.platform_fee).toBeNull();
    expect(transaction.gateway_reference).toBeNull();
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
