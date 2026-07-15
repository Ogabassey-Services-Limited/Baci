import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markPaypalTransactionRefunded } from './mark-paypal-transaction-refunded';
import { refundCapturedPaypalOrder } from './paypal-capture-execute';
import { initiatePaypalOrderRefund } from './paypal-order-refund';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./paypal-order-refund', () => ({
  initiatePaypalOrderRefund: vi.fn(),
}));

vi.mock('./mark-paypal-transaction-refunded', () => ({
  markPaypalTransactionRefunded: vi.fn().mockResolvedValue(undefined),
}));

function transactionClient(): SupabaseClient {
  const query: Record<string, unknown> = {};
  query.select = () => query;
  query.eq = () => query;
  query.maybeSingle = () =>
    Promise.resolve({
      data: {
        gateway_response: {
          purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1' }] } }],
        },
      },
      error: null,
    });
  return { from: () => query } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refundCapturedPaypalOrder', () => {
  it('passes pending refund ids to the terminal transaction stamp for polling', async () => {
    vi.mocked(initiatePaypalOrderRefund).mockResolvedValue({
      success: false,
      pending: true,
      pendingRefundIds: ['REFUND-P'],
    });

    await refundCapturedPaypalOrder(
      {
        supabase: transactionClient(),
        merchantId: 'merchant-1',
        orderId: 'order-1',
        paypalOrderId: 'PP-1',
        environment: 'live',
        mode: 'live',
        credentials: { clientId: 'cid', secretKey: 'secret' },
        transaction: {
          id: 'txn-1',
          merchant_id: 'merchant-1',
          order_id: 'order-1',
          amount: 100,
          currency: 'USD',
          status: 'completed',
          metadata: {},
          platform_fee: 0,
        },
        orderSnapshot: {
          id: 'order-1',
          merchant_id: 'merchant-1',
          total: 100,
          currency: 'USD',
          customer_email: 'buyer@example.com',
          order_number: 'BACI-1',
          payment_status: 'unpaid',
          shipping_status: 'pending',
          amount_paid: 0,
          paid_transaction_id: null,
        },
        orderTotal: 100,
        lockedResidual: 100,
        currentResidual: 100,
      },
      undefined,
      'duplicate capture'
    );

    expect(markPaypalTransactionRefunded).toHaveBeenCalledWith(
      undefined,
      'txn-1',
      expect.stringContaining('PENDING'),
      { pending: true, pendingRefundIds: ['REFUND-P'] }
    );
  });
});
