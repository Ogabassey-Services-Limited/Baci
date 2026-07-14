import { NextResponse } from 'next/server';
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
import { refundDuplicatePaypalCapture } from './refund-duplicate-paypal-capture';

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

vi.mock('./refund-duplicate-paypal-capture', () => ({
  refundDuplicatePaypalCapture: vi.fn(),
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
function makeSupabase(
  steps: Array<{ data?: unknown; error?: unknown }>,
  options?: { claim?: { data?: unknown; error?: unknown } }
) {
  let i = 0;
  const captured: { updates: Record<string, unknown>[] } = { updates: [] };
  // The writer first CLAIMS the transaction row (refusing to settle against a
  // refunded/failed payment). That is a terminal call, so it consumes the first
  // programmed step — default it to a successful claim so each test keeps
  // describing only the order-level behaviour it cares about.
  const programmed = [
    options?.claim ?? { data: { id: TXN_ID }, error: null },
    ...steps,
  ];
  const next = () => programmed[i++] ?? { data: null, error: null };
  const from = () => {
    const b: Record<string, unknown> = {};
    b.update = (payload: Record<string, unknown>) => {
      captured.updates.push(payload);
      return b;
    };
    for (const m of ['select', 'eq', 'neq', 'in', 'insert']) {
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
    // amount_paid set once to the order total (F: exactly-once), and the
    // settling txn stamped atomically in the same CAS update. (updates[0] is now
    // the transaction claim that precedes the order CAS.)
    const orderUpdate = captured.updates.find(
      (u) => u.payment_status === 'paid'
    );
    expect(orderUpdate).toMatchObject({
      payment_status: 'paid',
      amount_paid: 130000,
      paid_transaction_id: TXN_ID,
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

  it('settler-retry: CAS loses, paid_transaction_id === this txn → idempotent 200, no refund, no side effects', async () => {
    const { client } = makeSupabase([
      { data: null, error: null }, // CAS update matched nothing
      {
        data: {
          payment_status: 'paid',
          order_number: 'BACI-1002',
          paid_transaction_id: TXN_ID,
        },
        error: null,
      },
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, status: 'success' });
    // This txn settled the order (retry) — never re-runs side effects, never
    // refunds, never files a review.
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
    expect(refundDuplicatePaypalCapture).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('different-settler: CAS loses, paid_transaction_id is another txn → refunds this duplicate capture (F1)', async () => {
    (
      refundDuplicatePaypalCapture as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      NextResponse.json({ success: true, status: 'success' })
    );
    const { client } = makeSupabase([
      { data: null, error: null }, // CAS update matched nothing
      {
        data: {
          payment_status: 'paid',
          order_number: 'BACI-1002',
          paid_transaction_id: 'another-txn-id',
        },
        error: null,
      },
      { data: { gateway_response: { capture: 'x' } }, error: null }, // txn gateway_response fetch
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));

    expect(res.status).toBe(200);
    expect(refundDuplicatePaypalCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        transactionId: TXN_ID,
        source: 'reconcile',
      })
    );
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('no-marker: CAS loses, paid but paid_transaction_id null → success + files a manual-check review (no auto-refund)', async () => {
    const { client } = makeSupabase([
      { data: null, error: null }, // CAS update matched nothing
      {
        data: {
          payment_status: 'paid',
          order_number: 'BACI-1002',
          paid_transaction_id: null,
        },
        error: null,
      },
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, status: 'success' });
    // Can't prove it's a duplicate → flag for manual check, never auto-refund.
    expect(refundDuplicatePaypalCapture).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ stage: 'paid_no_settler_marker' }),
      })
    );
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
    // The rollback must ALSO clear the settler marker the CAS stamped, or it
    // outlives the paid status and misattributes whatever tender pays the retry
    // (Codex pass-9 P1).
    expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure
    ).toHaveBeenCalledWith(expect.anything(), MERCHANT_ID, ORDER_ID, {
      payment_status: 'unpaid',
      shipping_status: 'pending',
      amount_paid: 0,
      paid_transaction_id: null,
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

  it('refunds a captured PayPal payment when the paid CAS loses to a partially-paid order', async () => {
    vi.mocked(refundDuplicatePaypalCapture).mockResolvedValue(
      NextResponse.json(
        { error: 'Order is no longer payable', code: 'ORDER_NOT_PAYABLE' },
        { status: 409 }
      )
    );
    const { client } = makeSupabase([
      { data: null, error: null }, // paid CAS matched nothing
      {
        data: {
          payment_status: 'partially_paid',
          order_number: 'BACI-1002',
          paid_transaction_id: null,
        },
        error: null,
      },
      { data: { gateway_response: { capture: 'x' } }, error: null },
    ]);

    const response = await reconcilePaypalOrderToPaid(input(client));

    expect(response.status).toBe(409);
    expect(refundDuplicatePaypalCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        transactionId: TXN_ID,
        source: 'reconcile_partially_paid_order',
      })
    );
    expect(runPaypalCaptureSideEffects).not.toHaveBeenCalled();
  });

  it('DB error on CAS update files review and returns 500', async () => {
    const { client } = makeSupabase([
      { data: null, error: { message: 'boom' } }, // CAS update errors
    ]);

    const res = await reconcilePaypalOrderToPaid(input(client));

    expect(res.status).toBe(500);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalled();
  });
  it('REFUSES to settle when the transaction was refunded concurrently (Fable F2)', async () => {
    // A refund lane (stale-amount rejection, mode mismatch, duplicate clawback)
    // can mark this txn `refunded` and hand the buyer their money back while this
    // lane is still holding a snapshot loaded before that. Every CAS below is on
    // `orders` alone, so without claiming the payment row the order would flip to
    // `paid` — pointing `paid_transaction_id` at a REFUNDED payment. The merchant
    // ships and the buyer already has the money.
    const { client, captured } = makeSupabase([], {
      claim: { data: null, error: null }, // no row matched: txn is terminal
    });

    const response = await reconcilePaypalOrderToPaid(input(client));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('TRANSACTION_NOT_SETTLEABLE');
    // The order must never have been touched.
    expect(captured.updates.some((u) => u.payment_status === 'paid')).toBe(
      false
    );
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { stage: 'transaction_not_settleable' },
      })
    );
  });

  it('heals a lost pending→completed flip by claiming the transaction on the way through', async () => {
    const { client, captured } = makeSupabase([
      { data: PAID_ORDER, error: null }, // CAS update
      { data: { metadata: {} }, error: null }, // split select
      { error: null }, // split update
    ]);

    await reconcilePaypalOrderToPaid(input(client));

    // The claim is an unconditional advance to `completed`, so a payment whose
    // flip write was lost still ends up correctly recorded.
    expect(captured.updates[0]).toMatchObject({ status: 'completed' });
  });
});
