import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { markPaypalTransactionRefunded } from '@/lib/payments/mark-paypal-transaction-refunded';
import { processOrderCancellationRefund } from '@/lib/payments/order-cancellation-refund';
import { refundPaypalOrder } from '@/lib/payments/refund-paypal-order';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paystack', () => ({ initiateRefund: vi.fn() }));
vi.mock('@/lib/payments/refund-paypal-order', () => ({
  refundPaypalOrder: vi.fn(),
}));
vi.mock('@/lib/payments/mark-paypal-transaction-refunded', () => ({
  markPaypalTransactionRefunded: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

function buildSupabase(): SupabaseClient {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({
        data: {
          id: 'txn-paypal-1',
          gateway: 'paypal',
          gateway_reference: 'PP-ORD-1',
          gateway_response: { purchase_units: [] },
          metadata: {},
        },
        error: null,
      })
    ),
  };
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refundPaypalOrder).mockResolvedValue({
    success: true,
    paypalRefunded: 50000,
    prepaidRestored: 15000,
    totalRefunded: 65000,
    paypalRefundIds: ['REFUND-1'],
    savingsRestored: true,
  });
  vi.mocked(markPaypalTransactionRefunded).mockResolvedValue(false);
});

describe('PayPal cancellation refund audit reporting', () => {
  it('preserves the refund outcome when the terminal audit write rejects', async () => {
    vi.mocked(markPaypalTransactionRefunded).mockRejectedValue(
      new Error('audit transport failed')
    );

    const result = await processOrderCancellationRefund(
      buildSupabase(),
      {
        id: 'order-1',
        merchant_id: 'merchant-1',
        order_number: 'BACI-1002',
        currency: 'NGN',
        amount_paid: 65000,
        payment_status: 'paid',
      },
      undefined
    );

    expect(result).toEqual({
      attempted: true,
      success: true,
      amount: 65000,
      refundId: 'REFUND-1',
      auditRecordFailed: true,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('terminal transaction audit'),
        orderId: 'order-1',
        transactionId: 'txn-paypal-1',
      })
    );
  });

  it('surfaces a non-throwing terminal audit failure', async () => {
    vi.mocked(markPaypalTransactionRefunded).mockResolvedValue(true);

    const result = await processOrderCancellationRefund(
      buildSupabase(),
      {
        id: 'order-1',
        merchant_id: 'merchant-1',
        currency: 'NGN',
        amount_paid: 65000,
        payment_status: 'paid',
      },
      undefined
    );

    expect(result.auditRecordFailed).toBe(true);
    expect(result.success).toBe(true);
  });

  it('preserves a pending refund when its terminal audit write rejects', async () => {
    vi.mocked(refundPaypalOrder).mockResolvedValue({
      success: false,
      paypalRefunded: 0,
      prepaidRestored: 15000,
      totalRefunded: 15000,
      paypalRefundIds: [],
      pendingRefundIds: ['REFUND-P'],
      refundPending: true,
      savingsRestored: true,
      error: 'PayPal refund is pending',
    });
    vi.mocked(markPaypalTransactionRefunded).mockRejectedValue(
      new Error('audit transport failed')
    );

    const result = await processOrderCancellationRefund(
      buildSupabase(),
      {
        id: 'order-1',
        merchant_id: 'merchant-1',
        currency: 'NGN',
        amount_paid: 65000,
        payment_status: 'paid',
      },
      undefined
    );

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
    expect(result).toEqual({
      attempted: true,
      success: false,
      amount: 15000,
      refundId: undefined,
      error: 'PayPal refund is pending',
      auditRecordFailed: true,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('terminal transaction audit'),
        transactionId: 'txn-paypal-1',
      })
    );
  });
});
