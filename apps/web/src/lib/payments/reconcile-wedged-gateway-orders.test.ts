import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileWedgedGatewayOrders } from '@/lib/payments/reconcile-wedged-gateway-orders';

const mocks = vi.hoisted(() => ({
  finalizeOrderGatewayPayment: vi.fn(),
  verifyKorapayPayment: vi.fn(),
  verifyPaystackPayment: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  verifyTransaction: mocks.verifyPaystackPayment,
}));
vi.mock('@/lib/korapay', () => ({
  verifyPayment: mocks.verifyKorapayPayment,
}));
vi.mock('@/lib/payments/finalize-order-gateway-payment', () => ({
  finalizeOrderGatewayPayment: mocks.finalizeOrderGatewayPayment,
}));

const wedgedCandidate = {
  amount: '58290.60',
  currency: 'NGN',
  gateway: 'paystack',
  gateway_reference: '100004260711172450165090811595',
  id: 'txn-1',
  merchant_id: 'merchant-1',
  order_id: 'order-1',
  orders: { cancelled_at: null, id: 'order-1', payment_status: 'pending' },
};

function buildSupabase(result: { data?: unknown[]; error?: unknown }) {
  const stampUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const builder: Record<string, unknown> = {
    update: stampUpdate,
  };
  for (const method of ['select', 'eq', 'neq', 'not', 'lt', 'is', 'order']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // `.limit()` is the terminal call in the sweep's candidate query chain;
  // resolution stamps go through `.update().eq()` on the same builder.
  builder.limit = vi
    .fn()
    .mockResolvedValue({ data: null, error: null, ...result });
  return {
    from: vi.fn().mockReturnValue(builder),
    stampUpdate,
  } as unknown as SupabaseClient & { stampUpdate: ReturnType<typeof vi.fn> };
}

const scheduleAfter = (task: () => Promise<void>) => {
  void task();
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcileWedgedGatewayOrders', () => {
  it('throws when the wedged-candidate lookup fails', async () => {
    const supabase = buildSupabase({ error: { message: 'db down' } });

    await expect(
      reconcileWedgedGatewayOrders({ scheduleAfter, supabase })
    ).rejects.toThrow('wedged_order_lookup_failed');
  });

  it('returns an empty summary when nothing is wedged', async () => {
    const supabase = buildSupabase({ data: [] });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary).toEqual({
      checked: 0,
      detectedUnhealable: [],
      failed: [],
      healed: [],
      reviewsFiled: [],
      skipped: [],
    });
  });

  it('re-verifies with Paystack and heals a wedged order', async () => {
    const supabase = buildSupabase({ data: [wedgedCandidate] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 5829060, currency: 'NGN', status: 'success' },
      success: true,
    });
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      healed: true,
      kind: 'completed',
      orderNumber: 'ORD-260711-00NT-5',
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(mocks.verifyPaystackPayment).toHaveBeenCalledWith(
      wedgedCandidate.gateway_reference
    );
    expect(mocks.finalizeOrderGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'cron:reconcile-gateway-paid-orders',
        orderId: 'order-1',
        wonTransactionFlip: false,
      })
    );
    expect(summary.healed).toEqual([
      { orderId: 'order-1', orderNumber: 'ORD-260711-00NT-5' },
    ]);
  });

  it('skips a candidate the gateway does not confirm as success', async () => {
    const supabase = buildSupabase({ data: [wedgedCandidate] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 5829060, currency: 'NGN', status: 'abandoned' },
      success: true,
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.skipped).toEqual([
      { reason: 'paystack_verification_not_success', transactionId: 'txn-1' },
    ]);
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
  });

  it('skips on gateway/db amount mismatch instead of healing', async () => {
    const supabase = buildSupabase({ data: [wedgedCandidate] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 100, currency: 'NGN', status: 'success' },
      success: true,
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.skipped).toEqual([
      { reason: 'amount_mismatch', transactionId: 'txn-1' },
    ]);
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
  });

  it('skips on currency mismatch', async () => {
    const supabase = buildSupabase({ data: [wedgedCandidate] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 5829060, currency: 'USD', status: 'success' },
      success: true,
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.skipped).toEqual([
      { reason: 'currency_mismatch', transactionId: 'txn-1' },
    ]);
  });

  it('surfaces unhealable gateways loudly instead of guessing', async () => {
    const supabase = buildSupabase({
      data: [{ ...wedgedCandidate, gateway: 'juicyway' }],
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.detectedUnhealable).toEqual([
      { gateway: 'juicyway', transactionId: 'txn-1' },
    ]);
    expect(mocks.finalizeOrderGatewayPayment).not.toHaveBeenCalled();
    // Logged once, stamped so it never consumes the hourly batch again.
    expect(supabase.stampUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          wedge_sweep_resolution: 'unhealable_gateway_logged',
        }),
      })
    );
  });

  it('files the review and stamps a wedged payment whose order was cancelled', async () => {
    const cancelledCandidate = {
      ...wedgedCandidate,
      orders: {
        cancelled_at: '2026-07-12T00:00:00Z',
        id: 'order-1',
        payment_status: 'cancelled',
      },
    };
    const supabase = buildSupabase({ data: [cancelledCandidate] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 5829060, currency: 'NGN', status: 'success' },
      success: true,
    });
    mocks.finalizeOrderGatewayPayment.mockResolvedValue({
      kind: 'order_cancelled',
      orderNumber: 'ORD-1',
    });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.reviewsFiled).toEqual([
      { orderId: 'order-1', transactionId: 'txn-1' },
    ]);
    expect(supabase.stampUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          wedge_sweep_resolution: 'order_cancelled',
        }),
      })
    );
  });

  it('records finalizer failures without aborting the run', async () => {
    const second = {
      ...wedgedCandidate,
      gateway: 'korapay',
      gateway_reference: 'BAC-KORA',
      id: 'txn-2',
      order_id: 'order-2',
    };
    const supabase = buildSupabase({ data: [wedgedCandidate, second] });
    mocks.verifyPaystackPayment.mockResolvedValue({
      data: { amount: 5829060, currency: 'NGN', status: 'success' },
      success: true,
    });
    mocks.verifyKorapayPayment.mockResolvedValue({
      data: { amount: 58290.6, currency: 'NGN', status: 'success' },
      success: true,
    });
    mocks.finalizeOrderGatewayPayment
      .mockResolvedValueOnce({ error: 'x', kind: 'completion_failed' })
      .mockResolvedValueOnce({
        healed: true,
        kind: 'completed',
        orderNumber: 'ORD-2',
      });

    const summary = await reconcileWedgedGatewayOrders({
      scheduleAfter,
      supabase,
    });

    expect(summary.failed).toEqual([
      { reason: 'completion_failed', transactionId: 'txn-1' },
    ]);
    expect(summary.healed).toEqual([
      { orderId: 'order-2', orderNumber: 'ORD-2' },
    ]);
    expect(summary.checked).toBe(2);
  });
});
