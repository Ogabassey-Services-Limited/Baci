import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeOrderGatewayPayment } from '@/lib/payments/finalize-order-gateway-payment';
import {
  baseArgs,
  buildSupabase,
  completion,
  richOrderRow,
} from '@/lib/payments/finalize-order-gateway-payment-fixtures';

const mocks = vi.hoisted(() => ({
  completeOrderGatewayPayment: vi.fn(),
  ensurePaidOrderInventoryConfirmed: vi.fn(),
  fileInventoryConfirmationFailureReview: vi.fn(),
  handlePaymentForCancelledOrder: vi.fn(),
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
  persistPaidOrderSideEffectRetry: vi.fn(),
  rollbackOrderStatusAfterInventoryConfirmationFailure: vi.fn(),
  runPaidOrderSideEffects: vi.fn(),
}));

vi.mock(
  '@/lib/payments/complete-order-gateway-payment',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    completeOrderGatewayPayment: mocks.completeOrderGatewayPayment,
  })
);
vi.mock(
  '@/lib/payments/ensure-paid-order-inventory-confirmed',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ensurePaidOrderInventoryConfirmed: mocks.ensurePaidOrderInventoryConfirmed,
    rollbackOrderStatusAfterInventoryConfirmationFailure:
      mocks.rollbackOrderStatusAfterInventoryConfirmationFailure,
  })
);
vi.mock('@/lib/payments/file-inventory-confirmation-review', () => ({
  fileInventoryConfirmationFailureReview:
    mocks.fileInventoryConfirmationFailureReview,
}));
vi.mock('@/lib/payments/handle-payment-for-cancelled-order', () => ({
  handlePaymentForCancelledOrder: mocks.handlePaymentForCancelledOrder,
}));
vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: mocks.notifyNewOrder,
  notifyPaymentReceived: mocks.notifyPaymentReceived,
}));
vi.mock('@/lib/payments/paid-order-retry-persistence', () => ({
  persistPaidOrderSideEffectRetry: mocks.persistPaidOrderSideEffectRetry,
}));
vi.mock('@/lib/payments/run-paid-order-side-effects', () => ({
  runPaidOrderSideEffects: mocks.runPaidOrderSideEffects,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runPaidOrderSideEffects.mockResolvedValue({
    concurrentTakeoverSteps: [],
    failedSteps: [],
    ranSteps: ['merchant_settlement'],
    skippedSteps: [],
  });
});

describe('finalizeOrderGatewayPayment', () => {
  it('returns completion_failed when the atomic RPC fails', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue({
      error: new Error('boom'),
      ok: false,
    });

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({}))
    );

    expect(outcome.kind).toBe('completion_failed');
    expect(mocks.runPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('returns completion_failed on an RPC-level error code', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({ error_code: 'ORDER_NOT_FOUND' })
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({}))
    );

    expect(outcome.kind).toBe('completion_failed');
  });

  it('files a cancellation review and suppresses side effects for cancelled orders', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({
        cancelled_at: '2026-07-01T00:00:00Z',
        order_cancelled: true,
        order_updated: false,
      })
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({}))
    );

    expect(outcome.kind).toBe('order_cancelled');
    expect(mocks.handlePaymentForCancelledOrder).toHaveBeenCalledTimes(1);
    expect(mocks.runPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('skips refunded orders but files a durable reconciliation review', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({ order_skipped_status: 'refunded', order_updated: false })
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({}))
    );

    expect(outcome).toEqual({
      kind: 'order_skipped',
      paymentStatus: 'refunded',
    });
    expect(mocks.handlePaymentForCancelledOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        issueType: 'payment_received_after_refund',
        order: { id: 'order-1' },
      })
    );
    expect(mocks.runPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('completes the happy path: inventory, push, and side effects', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(completion());
    mocks.ensurePaidOrderInventoryConfirmed.mockResolvedValue(undefined);

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }))
    );

    expect(outcome).toEqual({
      healed: false,
      kind: 'completed',
      orderNumber: null,
    });
    expect(mocks.ensurePaidOrderInventoryConfirmed).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'order-1'
    );
    expect(mocks.notifyPaymentReceived).toHaveBeenCalled();
    expect(mocks.runPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        externalGatewayReference: 'REF',
        settlementGateway: 'paystack',
        transaction: expect.objectContaining({
          id: 'txn-1',
          platform_fee: 1165.81,
        }),
      })
    );
  });

  it('flags a heal when the transaction was completed earlier', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({ already_completed: true })
    );
    mocks.ensurePaidOrderInventoryConfirmed.mockResolvedValue(undefined);

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }), {
        wonTransactionFlip: false,
      })
    );

    expect(outcome).toMatchObject({ healed: true, kind: 'completed' });
    expect(mocks.notifyPaymentReceived).toHaveBeenCalled();
  });

  it('drains side effects without push on a pure replay', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({
        already_completed: true,
        order_already_paid: true,
        order_updated: false,
      })
    );
    mocks.ensurePaidOrderInventoryConfirmed.mockResolvedValue(undefined);

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }), {
        wonTransactionFlip: false,
      })
    );

    expect(outcome).toMatchObject({ healed: false, kind: 'completed' });
    expect(mocks.notifyNewOrder).not.toHaveBeenCalled();
    expect(mocks.notifyPaymentReceived).not.toHaveBeenCalled();
    expect(mocks.runPaidOrderSideEffects).toHaveBeenCalledTimes(1);
  });

  it('returns order_fetch_failed and persists retry markers so the cron drain can find the order', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(completion());
    mocks.persistPaidOrderSideEffectRetry.mockResolvedValue(undefined);

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ error: { message: 'network' } }))
    );

    expect(outcome.kind).toBe('order_fetch_failed');
    expect(mocks.persistPaidOrderSideEffectRetry).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', reference: 'REF' })
    );
    expect(mocks.runPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('does not write retry markers when a pure replay fails the order fetch', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({
        already_completed: true,
        order_already_paid: true,
        order_updated: false,
      })
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ error: { message: 'network' } }), {
        wonTransactionFlip: false,
      })
    );

    expect(outcome.kind).toBe('order_fetch_failed');
    expect(mocks.persistPaidOrderSideEffectRetry).not.toHaveBeenCalled();
  });

  it('rolls back to the RPC-reported previous statuses on inventory failure', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({ previous_payment_status: 'partially_paid' })
    );
    mocks.ensurePaidOrderInventoryConfirmed.mockRejectedValue(
      new Error('inventory down')
    );
    mocks.rollbackOrderStatusAfterInventoryConfirmationFailure.mockResolvedValue(
      undefined
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }))
    );

    expect(outcome.kind).toBe('inventory_failed');
    expect(
      mocks.rollbackOrderStatusAfterInventoryConfirmationFailure
    ).toHaveBeenCalledWith(expect.anything(), 'merchant-1', 'order-1', {
      payment_status: 'partially_paid',
      shipping_status: 'pending',
    });
  });

  it('does not roll back a replay whose order was already paid before this call', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(
      completion({
        already_completed: true,
        order_already_paid: true,
        order_updated: false,
      })
    );
    mocks.ensurePaidOrderInventoryConfirmed.mockRejectedValue(
      new Error('inventory down')
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }), {
        wonTransactionFlip: false,
      })
    );

    expect(outcome.kind).toBe('inventory_failed');
    expect(
      mocks.rollbackOrderStatusAfterInventoryConfirmationFailure
    ).not.toHaveBeenCalled();
  });

  it('files a review and fails closed when rollback also fails', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(completion());
    mocks.ensurePaidOrderInventoryConfirmed.mockRejectedValue(
      new Error('inventory down')
    );
    mocks.rollbackOrderStatusAfterInventoryConfirmationFailure.mockRejectedValue(
      new Error('rollback down')
    );

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }))
    );

    expect(outcome.kind).toBe('inventory_cleanup_failed');
    expect(mocks.fileInventoryConfirmationFailureReview).toHaveBeenCalled();
  });

  it('persists a retry marker instead of failing when side effects throw', async () => {
    mocks.completeOrderGatewayPayment.mockResolvedValue(completion());
    mocks.ensurePaidOrderInventoryConfirmed.mockResolvedValue(undefined);
    mocks.runPaidOrderSideEffects.mockRejectedValue(new Error('zepto down'));
    mocks.persistPaidOrderSideEffectRetry.mockResolvedValue(undefined);

    const outcome = await finalizeOrderGatewayPayment(
      baseArgs(buildSupabase({ data: richOrderRow }))
    );

    expect(outcome.kind).toBe('completed');
    expect(mocks.persistPaidOrderSideEffectRetry).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', reference: 'REF' })
    );
  });
});
