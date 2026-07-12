import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPaypalCaptureContext } from './load-paypal-capture-context';
import { computeOrderResidualAmount } from './order-residual-amount';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./order-residual-amount', () => ({
  computeOrderResidualAmount: vi.fn(),
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
    paypal_mode: 'live',
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
  payment_status: 'unpaid',
  amount_paid: 0,
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

describe('loadPaypalCaptureContext (state loader)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: true,
      walletAmountUsed: 30000,
      savingsAmountUsed: 0,
      residualAmount: 100000,
    });
  });

  it('returns the raw state with locked + current residual (no proceed/reconcile decision)', async () => {
    const result = await loadPaypalCaptureContext(buildSupabase({}), input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.lockedResidual).toBe(130000);
    expect(result.currentResidual).toBe(100000);
    expect(result.transaction.id).toBe('txn-1');
    expect(result.orderSnapshot.payment_status).toBe('unpaid');
    expect(result.presentmentAmount).toBe(100);
    expect(result.presentmentCurrency).toBe('USD');
  });

  it('accepts an already-completed transaction (reconcile is decided by the resolver, not here)', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: { ...PENDING_TXN, status: 'completed' } }),
      input
    );
    expect(result.ok).toBe(true);
  });

  it('404s when the transaction is missing', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: null }),
      input
    );
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('400s on a non-pending / non-completed transaction', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ txn: { ...PENDING_TXN, status: 'failed' } }),
      input
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('400s on a transaction metadata email mismatch', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({
        txn: {
          ...PENDING_TXN,
          metadata: { customer_email: 'someone-else@example.com' },
        },
      }),
      input
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('404s when the order is missing', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ order: null }),
      input
    );
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('400s on an order/transaction currency mismatch', async () => {
    const result = await loadPaypalCaptureContext(
      buildSupabase({ order: { ...ORDER_SNAPSHOT, currency: 'USD' } }),
      input
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('500s when the residual lookup fails', async () => {
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: false,
      reason: 'wallet_lookup_failed',
    });
    const result = await loadPaypalCaptureContext(buildSupabase({}), input);
    expect(result).toMatchObject({ ok: false, status: 500 });
  });
});
