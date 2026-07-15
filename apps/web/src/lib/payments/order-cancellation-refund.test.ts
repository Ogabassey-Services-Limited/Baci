import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markPaypalTransactionRefunded } from '@/lib/payments/mark-paypal-transaction-refunded';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';
import {
  processOrderCancellationRefund,
  type RefundableOrder,
} from './order-cancellation-refund';
import { refundPaypalOrder } from './refund-paypal-order';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paystack', () => ({
  initiateRefund: vi.fn(),
}));

vi.mock('@/lib/payments/refund-paypal-order', () => ({
  refundPaypalOrder: vi.fn(),
}));

vi.mock('@/lib/payments/mark-paypal-transaction-refunded', () => ({
  markPaypalTransactionRefunded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const ORDER: RefundableOrder = {
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_number: 'BACI-1002',
  currency: 'NGN',
  amount_paid: 65000,
  payment_status: 'paid',
};

/**
 * Builds a Supabase test double where `from('transactions')` serves both the
 * completed-payment lookup (`.select().eq().eq().eq().single()`) and the refund
 * audit insert (`.insert()`).
 */
function buildSupabase(opts: { transaction?: unknown; insertError?: unknown }) {
  const insert = vi.fn(() =>
    Promise.resolve({ error: opts.insertError ?? null })
  );
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({
        data: opts.transaction ?? null,
        error: opts.transaction ? null : { message: 'not found' },
      })
    ),
    insert,
  };
  return { from: vi.fn(() => chain), _insert: insert };
}

describe('processOrderCancellationRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markPaypalTransactionRefunded).mockResolvedValue(false);
    vi.mocked(initiatePaystackRefund).mockResolvedValue({
      success: true,
      data: { id: 987 },
    } as never);
    vi.mocked(refundPaypalOrder).mockResolvedValue({
      success: true,
      paypalRefunded: 50000,
      prepaidRestored: 15000,
      totalRefunded: 65000,
      paypalRefundIds: ['REFUND-1'],
      savingsRestored: true,
    });
  });

  it('does not attempt a refund when nothing was paid', async () => {
    const supabase = buildSupabase({});

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      { ...ORDER, amount_paid: 0 },
      undefined
    );

    expect(result).toEqual({ attempted: false, success: false, amount: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reports an attempt but no success when the order is not marked paid', async () => {
    const supabase = buildSupabase({});

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      { ...ORDER, payment_status: 'unpaid' },
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
    });
  });

  it('refunds a paid Paystack order and records the audit row', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paystack',
        gateway_reference: 'PSK-REF',
        gateway_response: null,
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      'Customer changed mind'
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 987,
    });
    expect(initiatePaystackRefund).toHaveBeenCalledWith(
      'PSK-REF',
      6500000, // kobo
      'Customer changed mind'
    );
    expect(supabase._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'refund',
        gateway: 'paystack',
        gateway_reference: '987',
        amount: 65000,
      })
    );
  });

  it('routes a paid PayPal order through the mixed-tender splitter and reports the true total (F-74)', async () => {
    const supabase = buildSupabase({
      transaction: {
        id: 'txn-paypal-1',
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: { purchase_units: [] },
        metadata: {
          paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
        },
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000, // paypal residual (50k) + prepaid restored (15k)
      refundId: 'REFUND-1',
    });
    expect(refundPaypalOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        order: expect.objectContaining({ id: 'order-1', currency: 'NGN' }),
        transaction: expect.objectContaining({
          gateway_response: { purchase_units: [] },
          metadata: {
            paypal_split: { paypalResidualPaid: 50000, prepaidPaid: 15000 },
          },
        }),
        reason: 'Order cancelled',
      })
    );
    expect(markPaypalTransactionRefunded).toHaveBeenCalledWith(
      undefined,
      'txn-paypal-1',
      'order cancellation refund completed',
      { pending: false }
    );
    // The splitter records its own per-channel audit rows; the caller does not.
    expect(supabase._insert).not.toHaveBeenCalled();
  });

  it('surfaces a PayPal split failure', async () => {
    vi.mocked(refundPaypalOrder).mockResolvedValue({
      success: false,
      paypalRefunded: 0,
      prepaidRestored: 0,
      totalRefunded: 0,
      paypalRefundIds: [],
      savingsRestored: false,
      error: 'PayPal capture reference not found for this order',
    });
    const supabase = buildSupabase({
      transaction: {
        id: 'txn-paypal-1',
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: {},
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 0,
      error: 'PayPal capture reference not found for this order',
    });
    expect(markPaypalTransactionRefunded).not.toHaveBeenCalled();
  });

  it('records an accepted PayPal cancellation refund as refund_pending with its refund ids', async () => {
    vi.mocked(refundPaypalOrder).mockResolvedValue({
      success: false,
      refundPending: true,
      pendingRefundIds: ['REFUND-P'],
      paypalRefunded: 0,
      prepaidRestored: 15000,
      totalRefunded: 15000,
      paypalRefundIds: [],
      savingsRestored: true,
      error: 'PayPal refund is pending',
    });
    const supabase = buildSupabase({
      transaction: {
        id: 'txn-paypal-1',
        gateway: 'paypal',
        gateway_reference: 'PP-ORD-1',
        gateway_response: { purchase_units: [] },
        metadata: {},
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result.success).toBe(false);
    expect(markPaypalTransactionRefunded).toHaveBeenCalledWith(
      undefined,
      'txn-paypal-1',
      'order cancellation refund pending',
      {
        pending: true,
        pendingRefundIds: ['REFUND-P'],
        restorePrepaidOnReconcile: true,
      }
    );
  });

  it('flags auditRecordFailed when a Paystack refund succeeds but the audit insert fails', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'paystack',
        gateway_reference: 'PSK-REF',
        gateway_response: null,
      },
      insertError: { message: 'db down' },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 987,
      auditRecordFailed: true,
    });
  });

  it('rejects an unsupported gateway', async () => {
    const supabase = buildSupabase({
      transaction: {
        gateway: 'stripe',
        gateway_reference: 'STR-1',
        gateway_response: null,
      },
    });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
      error: 'Unsupported gateway: stripe',
    });
    expect(supabase._insert).not.toHaveBeenCalled();
  });

  it('reports failure when no completed payment transaction exists', async () => {
    const supabase = buildSupabase({ transaction: null });

    const result = await processOrderCancellationRefund(
      supabase as unknown as SupabaseClient,
      ORDER,
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 65000,
      error: 'No completed payment transaction found',
    });
  });
});
