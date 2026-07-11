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
  total: 130000,
  amount_paid: 0,
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

// The order UPDATE now uses a `.neq('payment_status','paid')` CAS + maybeSingle
// (F-268), and the `!order` (lost-claim) branch re-reads `orders`. The mock
// returns `orderResult` for the UPDATE chain and `reReadResult` for the plain
// SELECT re-read so both paths are exercised.
function buildSupabase(
  orderResult: { data: unknown; error: unknown },
  reReadResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  let lastWasUpdate = false;
  const client = {
    from: vi.fn(() => {
      lastWasUpdate = false;
      return client;
    }),
    update: vi.fn(() => {
      lastWasUpdate = true;
      return client;
    }),
    eq: vi.fn(() => client),
    neq: vi.fn(() => client),
    select: vi.fn(() => client),
    maybeSingle: vi.fn(() =>
      Promise.resolve(lastWasUpdate ? orderResult : reReadResult)
    ),
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

  it('marks the order paid, records amount_paid, claims via CAS, confirms inventory, and schedules side effects', async () => {
    const supabase = buildSupabase({ data: PAID_ORDER, error: null });

    const response = await call(supabase);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      status: 'success',
      orderNumber: 'BACI-1002',
    });
    // F-58: the captured (order-currency) total is persisted to amount_paid so
    // the cancellation refund path (which gates on amount_paid > 0) can fire.
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'paid', amount_paid: 130000 })
    );
    // F-268: the paid transition is claimed with a `payment_status != 'paid'` CAS.
    expect(supabase.neq).toHaveBeenCalledWith('payment_status', 'paid');
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

  it('returns idempotent success WITHOUT re-running side effects when it loses the paid claim (F-268)', async () => {
    // The CAS matched no row (a concurrent reconcile already flipped the order to
    // paid). The re-read shows it paid, so this loser returns success and must
    // NOT re-run side effects or re-add amount_paid.
    const supabase = buildSupabase(
      { data: null, error: null },
      {
        data: { payment_status: 'paid', order_number: 'BACI-1002' },
        error: null,
      }
    );

    const response = await call(supabase);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      status: 'success',
      orderNumber: 'BACI-1002',
    });
    expect(ensurePaidOrderInventoryConfirmed).not.toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('files reconciliation and returns 500 when the CAS matches no row and the order is still unpaid', async () => {
    // No row updated AND the re-read is not paid → a genuine persist failure, not
    // a lost claim. Never silently drop the captured payment.
    const supabase = buildSupabase(
      { data: null, error: null },
      {
        data: { payment_status: 'unpaid', order_number: 'BACI-1002' },
        error: null,
      }
    );

    const response = await call(supabase);

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('CAPTURE_PERSIST_FAILED');
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { stage: 'order_update' } })
    );
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
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
      // F-58: the paid update set amount_paid to the total; rollback restores the
      // pre-capture value so an unpaid order never reads as fully paid.
      amount_paid: 0,
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
