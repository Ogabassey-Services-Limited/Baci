import { beforeEach, describe, expect, it, vi } from 'vitest';
import { retireWedgeWithReview } from '@/lib/payments/retire-wedge-with-review';

const mocks = vi.hoisted(() => ({
  handlePaymentForCancelledOrder: vi.fn(),
}));

vi.mock('@/lib/payments/handle-payment-for-cancelled-order', () => ({
  handlePaymentForCancelledOrder: mocks.handlePaymentForCancelledOrder,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

function buildSupabase() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { eq, from, supabase: { from }, update };
}

describe('retireWedgeWithReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('files a transaction-scoped review before stamping the wedge resolved', async () => {
    mocks.handlePaymentForCancelledOrder.mockResolvedValue(true);
    const { supabase, update } = buildSupabase();

    const result = await retireWedgeWithReview({
      candidate: {
        gateway: 'paystack',
        gateway_reference: 'ref-1',
        id: 'txn-1',
        metadata: null,
        order_id: 'order-1',
      },
      reason: 'manual reconciliation required',
      resolution: 'gateway_reference_invalid',
      supabase: supabase as never,
    });

    expect(result).toBe(true);
    expect(mocks.handlePaymentForCancelledOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        issueType: 'gateway_payment_wedge_requires_review',
        transactionId: 'txn-1',
      })
    );
    expect(update).toHaveBeenCalled();
  });

  it('does not retire a wedge when its review is not durable', async () => {
    mocks.handlePaymentForCancelledOrder.mockResolvedValue(false);
    const { supabase, update } = buildSupabase();

    const result = await retireWedgeWithReview({
      candidate: {
        gateway: 'paystack',
        gateway_reference: 'ref-1',
        id: 'txn-1',
        metadata: null,
        order_id: 'order-1',
      },
      reason: 'manual reconciliation required',
      resolution: 'gateway_reference_invalid',
      supabase: supabase as never,
    });

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
