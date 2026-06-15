import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from './handle-payment-for-cancelled-order';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { logger } = await import('@/lib/logger');

function createSupabaseWithInsert(insertResult: { error: unknown }): {
  insert: ReturnType<typeof vi.fn>;
  supabase: SupabaseClient;
} {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const supabase = {
    from: vi.fn(() => ({ insert })),
  } as unknown as SupabaseClient;
  return { insert, supabase };
}

describe('isOrderClampedAsCancelled', () => {
  it('returns true when shipping_status is cancelled', () => {
    expect(
      isOrderClampedAsCancelled({ id: 'o1', shipping_status: 'cancelled' })
    ).toBe(true);
  });

  it('returns true when cancelled_at is set even if shipping_status differs', () => {
    expect(
      isOrderClampedAsCancelled({
        id: 'o1',
        cancelled_at: '2026-06-15T00:00:00Z',
        shipping_status: 'processing',
      })
    ).toBe(true);
  });

  it('returns false for an active processing order', () => {
    expect(
      isOrderClampedAsCancelled({
        id: 'o1',
        cancelled_at: null,
        shipping_status: 'processing',
      })
    ).toBe(false);
  });

  it('returns false for null/undefined order', () => {
    expect(isOrderClampedAsCancelled(null)).toBe(false);
    expect(isOrderClampedAsCancelled(undefined)).toBe(false);
  });
});

describe('handlePaymentForCancelledOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a payment_received_after_cancellation reconciliation row and warns', async () => {
    const { insert, supabase } = createSupabaseWithInsert({ error: null });

    await handlePaymentForCancelledOrder({
      gatewayReference: 'BAC-123',
      order: { id: 'order-1', shipping_status: 'cancelled' },
      reason: 'Paystack payment captured after cancellation',
      supabase,
      transactionId: 'txn-1',
    });

    expect(insert).toHaveBeenCalledWith({
      candidates: null,
      issue_type: 'payment_received_after_cancellation',
      order_id: 'order-1',
      paystack_ref: 'BAC-123',
      reason: 'Paystack payment captured after cancellation',
      txn_id: 'txn-1',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: 'BAC-123',
        orderId: 'order-1',
        transactionId: 'txn-1',
      })
    );
  });

  it('treats a duplicate (23505) as a benign no-op and does not log an error', async () => {
    const { supabase } = createSupabaseWithInsert({
      error: { code: '23505', message: 'duplicate key value' },
    });

    await handlePaymentForCancelledOrder({
      gatewayReference: 'BAC-123',
      order: { id: 'order-1', shipping_status: 'cancelled' },
      reason: 'retry',
      supabase,
      transactionId: 'txn-1',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1' })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error (but does not throw) when the insert fails for a non-duplicate reason', async () => {
    const { supabase } = createSupabaseWithInsert({
      error: { code: '500', message: 'boom' },
    });

    await expect(
      handlePaymentForCancelledOrder({
        gatewayReference: null,
        order: { id: 'order-1', shipping_status: 'cancelled' },
        reason: 'failure path',
        supabase,
        transactionId: null,
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Failed to file payment_received_after_cancellation reconciliation',
        orderId: 'order-1',
      })
    );
  });
});
