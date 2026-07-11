import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadPaypalCaptureContext } from './load-paypal-capture-context';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';
const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const PAYPAL_ORDER_ID = 'PP-ORD-1';

const PENDING_TXN = {
  id: 'txn-1',
  order_id: ORDER_ID,
  merchant_id: MERCHANT_ID,
  amount: 130000,
  currency: 'NGN',
  status: 'pending',
  metadata: {
    customer_email: 'customer@example.com',
    paypal_presentment_amount: 100,
    paypal_presentment_currency: 'USD',
  },
  platform_fee: 0,
};

const ORDER_SNAPSHOT = {
  id: ORDER_ID,
  merchant_id: MERCHANT_ID,
  total: 130000,
  currency: 'NGN',
  customer_email: 'customer@example.com',
  order_number: 'BACI-1002',
  shipping_status: 'pending',
};

function buildSupabase({
  txn = PENDING_TXN as Record<string, unknown> | null,
  order = ORDER_SNAPSHOT as Record<string, unknown> | null,
}: {
  txn?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
}) {
  let lastTable = '';
  const client = {
    from: vi.fn((table: string) => {
      lastTable = table;
      return client;
    }),
    select: vi.fn(() => client),
    eq: vi.fn(() => client),
    maybeSingle: vi.fn(() => {
      if (lastTable === 'transactions') {
        return Promise.resolve({ data: txn, error: null });
      }
      if (lastTable === 'orders') {
        return Promise.resolve({ data: order, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };
  return client as unknown as SupabaseClient;
}

const input = {
  orderId: ORDER_ID,
  paypalOrderId: PAYPAL_ORDER_ID,
  merchantId: MERCHANT_ID,
  customerEmail: 'customer@example.com',
};

describe('loadPaypalCaptureContext', () => {
  it('proceeds with the validated transaction and order snapshot', async () => {
    const result = await loadPaypalCaptureContext(buildSupabase({}), input);

    expect(result.proceed).toBe(true);
    if (result.proceed) {
      expect(result.reconcileOnly).toBe(false);
      expect(result.transaction.id).toBe('txn-1');
      expect(result.orderSnapshot.order_number).toBe('BACI-1002');
      expect(result.metadata?.paypal_presentment_amount).toBe(100);
    }
  });

  it('returns 404 when the transaction is not found', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: null }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    });
  });

  it('returns 400 on order_id mismatch', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: { ...PENDING_TXN, order_id: 'other' } }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 400,
      body: { error: 'Order ID mismatch' },
    });
  });

  it('returns 400 on merchant mismatch', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: { ...PENDING_TXN, merchant_id: 'other' } }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 400,
      body: { error: 'Merchant mismatch' },
    });
  });

  it('returns an idempotent 200 when the transaction is completed and the order is paid', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({
        txn: { ...PENDING_TXN, status: 'completed' },
        order: { order_number: 'BACI-1002', payment_status: 'paid' },
      }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 200,
      body: { success: true, status: 'success', orderNumber: 'BACI-1002' },
    });
  });

  it('flags reconcileOnly when the transaction completed but the order is still unpaid', async () => {
    // A prior capture flipped the transaction to completed but its order write
    // failed, leaving the order unpaid. The loader must NOT short-circuit as a
    // success — it must signal the route to reconcile the failed order write.
    const result = await loadPaypalCaptureContext(
      buildSupabase({
        txn: { ...PENDING_TXN, status: 'completed' },
        order: { ...ORDER_SNAPSHOT, payment_status: 'unpaid' },
      }),
      input
    );

    expect(result.proceed).toBe(true);
    if (result.proceed) {
      expect(result.reconcileOnly).toBe(true);
      expect(result.orderSnapshot.order_number).toBe('BACI-1002');
    }
  });

  it('returns 400 when the transaction is in another non-pending state', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: { ...PENDING_TXN, status: 'failed' } }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 400,
      body: { error: 'Transaction is already in a non-pending state' },
    });
  });

  it('returns 400 on transaction-metadata email mismatch', async () => {
    const result = await loadPaypalCaptureContext(buildSupabase({}), {
      ...input,
      customerEmail: 'someone-else@example.com',
    });

    expect(result).toEqual({
      proceed: false,
      status: 400,
      body: { error: 'Customer email mismatch with transaction metadata' },
    });
  });

  it('returns 404 when the order is not found', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ order: null }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 404,
      body: { error: 'Order not found' },
    });
  });

  it('returns 400 on order amount/currency mismatch', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ order: { ...ORDER_SNAPSHOT, total: 999 } }),
      input
    );

    expect(result).toEqual({
      proceed: false,
      status: 400,
      body: { error: 'Order amount or currency mismatch with transaction' },
    });
  });
});
