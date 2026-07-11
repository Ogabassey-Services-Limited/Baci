import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
  SerializedInventoryUnavailableError,
} from './ensure-paid-order-inventory-confirmed';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';
import { finalizePaypalCaptureOrder } from './finalize-paypal-capture-order';
import { handlePaymentForCancelledOrder } from './handle-payment-for-cancelled-order';
import { runPaypalCaptureSideEffects } from './paypal-capture-side-effects';

vi.mock('server-only', () => ({}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: vi.fn((fn: () => unknown) => fn()) };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/payments/load-paypal-capture-context', () => ({
  orderNumberFallback: (id: string) => id.slice(0, 8).toUpperCase(),
}));

vi.mock('@/lib/payments/file-paypal-capture-persist-failure-review', () => ({
  filePaypalCapturePersistFailureReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/payments/paypal-capture-side-effects', () => ({
  runPaypalCaptureSideEffects: vi.fn().mockResolvedValue(undefined),
}));

// Keep the clamp predicate real (same logic) but spy the reconciliation filer.
vi.mock('@/lib/payments/handle-payment-for-cancelled-order', () => ({
  isOrderClampedAsCancelled: (
    order:
      | { shipping_status?: string | null; cancelled_at?: string | null }
      | null
      | undefined
  ) =>
    !!order &&
    (order.shipping_status === 'cancelled' || Boolean(order.cancelled_at)),
  handlePaymentForCancelledOrder: vi.fn().mockResolvedValue(undefined),
}));

// Provide a self-consistent error class + type guard so the real branch logic
// runs without pulling in the RPC/cache dependencies of the source module.
vi.mock('@/lib/payments/ensure-paid-order-inventory-confirmed', () => {
  class SerializedInventoryUnavailableError extends Error {
    constructor() {
      super('serialized_inventory_unavailable');
      this.name = 'SerializedInventoryUnavailableError';
    }
  }
  return {
    SerializedInventoryUnavailableError,
    isSerializedInventoryUnavailableError: (error: unknown) =>
      error instanceof SerializedInventoryUnavailableError,
    ensurePaidOrderInventoryConfirmed: vi.fn().mockResolvedValue(undefined),
    rollbackOrderStatusAfterInventoryConfirmationFailure: vi
      .fn()
      .mockResolvedValue(undefined),
  };
});

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';
const PAYPAL_ORDER_ID = 'PP-ORD-1';
const TRANSACTION = { id: 'txn-1', amount: 130000 };
const ORDER_SNAPSHOT = {
  order_number: 'BACI-1002',
  shipping_status: 'pending',
  payment_status: 'unpaid',
};

const PAID_ORDER = {
  id: ORDER_ID,
  order_number: 'BACI-1002',
  total: 130000,
  currency: 'NGN',
  shipping_status: 'processing',
  cancelled_at: null,
  order_items: [],
};

const CANCELLED_ORDER = {
  ...PAID_ORDER,
  shipping_status: 'cancelled',
  cancelled_at: '2026-07-11T00:00:00.000Z',
};

function buildSupabase(orderResult: { data: unknown; error: unknown }) {
  const client = {
    from: vi.fn(() => client),
    update: vi.fn(() => client),
    eq: vi.fn(() => client),
    select: vi.fn(() => client),
    single: vi.fn(() => Promise.resolve(orderResult)),
  };
  return client;
}

function call(
  supabase: ReturnType<typeof buildSupabase>,
  orderSnapshot = ORDER_SNAPSHOT
) {
  return finalizePaypalCaptureOrder({
    supabase: supabase as never,
    merchantId: MERCHANT_ID,
    orderId: ORDER_ID,
    paypalOrderId: PAYPAL_ORDER_ID,
    transaction: TRANSACTION,
    orderSnapshot,
  });
}

describe('finalizePaypalCaptureOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockResolvedValue(undefined);
    vi.mocked(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).mockResolvedValue(undefined);
  });

  it('marks the order paid, confirms inventory, and schedules side effects', async () => {
    const supabase = buildSupabase({ data: PAID_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      status: 'success',
      orderNumber: 'BACI-1002',
    });
    expect(ensurePaidOrderInventoryConfirmed).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      ORDER_ID
    );
    expect(runPaypalCaptureSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        paypalOrderId: PAYPAL_ORDER_ID,
        grossAmount: 130000,
      })
    );
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('files a reconciliation review and returns 500 when the order write fails', async () => {
    const supabase = buildSupabase({
      data: null,
      error: { message: 'db down' },
    });

    const response = await call(supabase);

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('CAPTURE_PERSIST_FAILED');
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { stage: 'order_update' } })
    );
    expect(ensurePaidOrderInventoryConfirmed).not.toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('suppresses side effects and files reconciliation when the order is clamped as cancelled (F1)', async () => {
    const supabase = buildSupabase({ data: CANCELLED_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(handlePaymentForCancelledOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: PAYPAL_ORDER_ID,
        transactionId: 'txn-1',
      })
    );
    expect(ensurePaidOrderInventoryConfirmed).not.toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('files reconciliation and returns 409 when serialized inventory is unavailable (F5)', async () => {
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new SerializedInventoryUnavailableError()
    );
    const supabase = buildSupabase({ data: PAID_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe(
      'serialized_inventory_unavailable'
    );
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { stage: 'inventory_confirmation' } })
    );
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).not.toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('rolls the order back and returns 500 on a transient inventory error (F5)', async () => {
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new Error('rpc timeout')
    );
    const supabase = buildSupabase({ data: PAID_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('INVENTORY_CONFIRMATION_FAILED');
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).toHaveBeenCalledWith(supabase, MERCHANT_ID, ORDER_ID, {
      payment_status: 'unpaid',
      shipping_status: 'pending',
    });
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('files reconciliation and returns 500 when inventory confirmation and rollback both fail (F5)', async () => {
    vi.mocked(ensurePaidOrderInventoryConfirmed).mockRejectedValueOnce(
      new Error('rpc timeout')
    );
    vi.mocked(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).mockRejectedValueOnce(new Error('rollback down'));
    const supabase = buildSupabase({ data: PAID_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe(
      'INVENTORY_CONFIRMATION_CLEANUP_FAILED'
    );
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          stage: 'inventory_confirmation_rollback',
        }),
      })
    );
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });
});
