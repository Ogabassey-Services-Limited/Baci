import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
  SerializedInventoryUnavailableError,
} from './ensure-paid-order-inventory-confirmed';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';
import { handlePaymentForCancelledOrder } from './handle-payment-for-cancelled-order';
import { runPaypalCaptureSideEffects } from './paypal-capture-side-effects';
import { reconcilePaypalOrderToPaid } from './reconcile-paypal-order';

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
const TXN_ID = 'txn-1';

const PAID_ORDER = {
  id: ORDER_ID,
  order_number: 'BACI-1002',
  total: 130000,
  currency: 'NGN',
  shipping_status: 'processing',
  cancelled_at: null,
  order_items: [],
};

/**
 * Minimal chainable Supabase mock: each terminal (`maybeSingle`, `single`, or
 * awaiting the builder directly) dequeues the next programmed result in
 * resolution order.
 */
function makeSupabase(steps: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const captured: { updates: Record<string, unknown>[] } = { updates: [] };
  const next = () => steps[i++] ?? { data: null, error: null };
  const from = () => {
    const b: Record<string, unknown> = {};
    b.update = (payload: Record<string, unknown>) => {
      captured.updates.push(payload);
      return b;
    };
    for (const m of ['select', 'eq', 'neq', 'insert']) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve(next());
    b.single = () => Promise.resolve(next());
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
    b.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown
    ) => Promise.resolve(next()).then(resolve, reject);
    return b;
  };
  return { client: { from } as never, captured };
}

function input(supabase: never, overrides?: Record<string, unknown>) {
  return {
    supabase,
    merchantId: MERCHANT_ID,
    orderId: ORDER_ID,
    paypalOrderId: PAYPAL_ORDER_ID,
    transactionId: TXN_ID,
    lockedResidual: 100000,
    orderTotal: 130000,
    prepaidTender: 30000,
    preCaptureStatus: {
      payment_status: 'unpaid',
      shipping_status: 'pending',
      amount_paid: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcilePaypalOrderToPaid', () => {
  it('capture-finalize: CAS winner marks paid, persists split, schedules side effects', async () => {
    const { client, captured } = makeSupabase([
      { data: PAID_ORDER, error: null }, // CAS update
      { data: { metadata: { paypal_mode: 'live' } }, error: null }, // split select
      { error: null }, // split update
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, status: 'success' });
    // amount_paid set once to the order total (F: exactly-once).
    expect(captured.updates[0]).toMatchObject({
      payment_status: 'paid',
      amount_paid: 130000,
    });
    // paypal_split persisted for the refund funnel (F-74).
    const splitUpdate = captured.updates.find((u) => 'metadata' in u) as {
      metadata: { paypal_split: unknown };
    };
    expect(splitUpdate.metadata.paypal_split).toEqual({
      paypalResidualPaid: 100000,
      prepaidPaid: 30000,
    });
    expect(runPaypalCaptureSideEffects).toHaveBeenCalledTimes(1);
  });

  it('block-already-paid: CAS loses, re-read shows paid → idempotent 200, no side effects (exactly-once)', async () => {
    const { client } = makeSupabase([
      { data: null, error: null }, // CAS update matched nothing
      {
        data: { payment_status: 'paid', order_number: 'BACI-1002' },
        error: null,
      },
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, status: 'success' });
    // The loser never re-runs side effects — the winner already did.
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('inventory-fail-rollback: serialized shortfall rolls back paid→pre-capture and returns 409 (F-182)', async () => {
    (
      ensurePaidOrderInventoryConfirmed as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new SerializedInventoryUnavailableError());
    const { client } = makeSupabase([
      { data: PAID_ORDER, error: null }, // CAS update
      { data: { metadata: {} }, error: null }, // split select
      { error: null }, // split update
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));

    expect(res.status).toBe(409);
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).toHaveBeenCalledWith(expect.anything(), MERCHANT_ID, ORDER_ID, {
      payment_status: 'unpaid',
      shipping_status: 'pending',
      amount_paid: 0,
    });
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('clamp-cancelled: trigger keeps order cancelled → suppress side effects, file review', async () => {
    const { client } = makeSupabase([
      {
        data: {
          ...PAID_ORDER,
          shipping_status: 'cancelled',
          cancelled_at: 'x',
        },
        error: null,
      }, // CAS update returns clamped row
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(handlePaymentForCancelledOrder).toHaveBeenCalledTimes(1);
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('block-refunded: CAS loses, re-read shows refunded → 409 ORDER_ALREADY_REFUNDED, no re-settle (Gap 2)', async () => {
    const { client } = makeSupabase([
      { data: null, error: null }, // CAS update matched nothing (refunded ≠ paid but guarded)
      {
        data: { payment_status: 'refunded', order_number: 'BACI-1002' },
        error: null,
      },
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe('ORDER_ALREADY_REFUNDED');
    // A refunded order is never re-settled and never re-files a persist review.
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('DB error on CAS update files review and returns 500', async () => {
    const { client } = makeSupabase([
      { data: null, error: { message: 'boom' } }, // CAS update errors
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));

    expect(res.status).toBe(500);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalled();
  });
});
