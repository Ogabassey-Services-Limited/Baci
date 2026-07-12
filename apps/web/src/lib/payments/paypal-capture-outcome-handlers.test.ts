import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureOrder, detectPayPalResponseMode, getOrder } from '@/lib/paypal';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';
import {
  refundCapturedPaypalOrder,
  settleCompletedPaypalOrder,
} from './paypal-capture-execute';
import { handlePaypalCaptureOutcome } from './paypal-capture-outcome-handlers';
import { markPaypalCredentialInvalid } from './paypal-checkout-credentials';
import { reconcilePaypalOrderToPaid } from './reconcile-paypal-order';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/paypal', () => ({
  captureOrder: vi.fn(),
  detectPayPalResponseMode: vi.fn(() => 'live'),
  getOrder: vi.fn(),
}));

vi.mock('./file-paypal-capture-persist-failure-review', () => ({
  filePaypalCapturePersistFailureReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./paypal-checkout-credentials', () => ({
  isPaypalAuthFailure: (code: string | undefined) => code === 'HTTP_401',
  markPaypalCredentialInvalid: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./reconcile-paypal-order', () => ({
  reconcilePaypalOrderToPaid: vi.fn(
    () =>
      new Response(JSON.stringify({ reconciled: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
  ),
}));

vi.mock('./paypal-capture-execute', () => ({
  buildPaypalCaptureState: (
    ctx: {
      orderSnapshot: Record<string, unknown>;
      transaction: Record<string, unknown>;
      lockedResidual: number;
      currentResidual: number;
      presentmentAmount?: number;
    },
    paypalOrderStatus: string
  ) => ({
    orderPaymentStatus: ctx.orderSnapshot.payment_status,
    orderShippingStatus: ctx.orderSnapshot.shipping_status,
    txnStatus: ctx.transaction.status,
    paypalOrderStatus,
    lockedResidual: ctx.lockedResidual,
    currentResidual: ctx.currentResidual,
    presentmentAmount: ctx.presentmentAmount,
  }),
  buildReconcileInput: (ctx: { transaction: { id: string } }) => ({
    transactionId: ctx.transaction.id,
  }),
  successResponse: () =>
    new Response(JSON.stringify({ success: true, idempotent: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  refundCapturedPaypalOrder: vi.fn().mockResolvedValue({ success: true }),
  settleCompletedPaypalOrder: vi.fn(
    () =>
      new Response(JSON.stringify({ settled: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
  ),
}));

function txnUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.update = () => chain;
  chain.eq = () => chain;
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve);
  return chain;
}

function ctxFixture(overrides: Record<string, unknown> = {}) {
  return {
    supabase: { from: () => txnUpdateChain() } as never,
    merchantId: 'm1',
    orderId: 'o1',
    paypalOrderId: 'PP-1',
    environment: 'live' as const,
    mode: 'live' as const,
    credentials: { clientId: 'cid', secretKey: 'sec' },
    transaction: {
      id: 'txn-1',
      order_id: 'o1',
      merchant_id: 'm1',
      amount: 100000,
      currency: 'NGN',
      status: 'pending',
      metadata: {},
      platform_fee: 0,
    },
    orderSnapshot: {
      id: 'o1',
      merchant_id: 'm1',
      total: 130000,
      currency: 'NGN',
      customer_email: 'c@e.com',
      order_number: 'BACI-1',
      shipping_status: 'pending',
      payment_status: 'unpaid',
      amount_paid: 0,
    },
    orderTotal: 130000,
    lockedResidual: 100000,
    currentResidual: 100000,
    presentmentAmount: 100,
    presentmentCurrency: 'USD',
    ...overrides,
  } as never;
}

const COMPLETED_CAPTURE = {
  status: 'COMPLETED',
  links: [],
  purchase_units: [
    {
      payments: {
        captures: [
          {
            id: 'CAP-1',
            status: 'COMPLETED',
            amount: { value: '100.00', currency_code: 'USD' },
          },
        ],
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(detectPayPalResponseMode).mockReturnValue('live');
});

describe('handlePaypalCaptureOutcome', () => {
  it('already_paid_idempotent → idempotent success', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'already_paid_idempotent' },
      undefined
    );
    const json = await res.json();
    expect(json.idempotent).toBe(true);
  });

  it('create_fresh → 409 PAYPAL_ORDER_NOT_APPROVABLE', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'create_fresh' },
      undefined
    );
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe('PAYPAL_ORDER_NOT_APPROVABLE');
  });

  it('capture_then_finalize (happy) → captures, validates, reconciles', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: COMPLETED_CAPTURE,
    } as never);

    await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'capture_then_finalize' },
      undefined
    );

    expect(captureOrder).toHaveBeenCalledTimes(1);
    expect(reconcilePaypalOrderToPaid).toHaveBeenCalledTimes(1);
  });

  it('capture 401 → marks the credential invalid and 400 INVALID_PROVIDER_CREDENTIALS', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: false,
      error: 'unauthorized',
      code: 'HTTP_401',
    } as never);

    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'capture_then_finalize' },
      undefined
    );
    const json = await res.json();

    expect(markPaypalCredentialInvalid).toHaveBeenCalledWith(
      'm1',
      'live',
      'unauthorized'
    );
    expect(res.status).toBe(400);
    expect(json.code).toBe('INVALID_PROVIDER_CREDENTIALS');
    expect(reconcilePaypalOrderToPaid).not.toHaveBeenCalled();
  });

  it('capture HTTP 422 (already captured) → re-resolves and reconciles, never charges twice', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: false,
      error: 'already captured',
      code: 'HTTP_422',
    } as never);
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-1', ...COMPLETED_CAPTURE },
    } as never);

    await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'capture_then_finalize' },
      undefined
    );

    // Re-resolved to reconcile_completed_unpaid → settle (no second capture).
    expect(settleCompletedPaypalOrder).toHaveBeenCalledTimes(1);
  });

  it('block_paid_elsewhere captured → auto-refunds, files captured_after_settlement, returns idempotent (F-203)', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture({
        orderSnapshot: {
          id: 'o1',
          merchant_id: 'm1',
          total: 130000,
          currency: 'NGN',
          customer_email: 'c@e.com',
          order_number: 'BACI-1',
          shipping_status: 'pending',
          payment_status: 'paid',
          amount_paid: 0,
        },
      }),
      { kind: 'block_paid_elsewhere', captured: true },
      { id: 'PP-1', status: 'COMPLETED' } as never
    );
    const json = await res.json();

    expect(refundCapturedPaypalOrder).toHaveBeenCalledTimes(1);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          stage: 'captured_after_settlement',
        }),
      })
    );
    expect(json.idempotent).toBe(true);
  });

  it('block_paid_elsewhere not-captured → files a stale-approval review, no refund', async () => {
    await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'block_paid_elsewhere', captured: false },
      undefined
    );
    expect(refundCapturedPaypalOrder).not.toHaveBeenCalled();
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          stage: 'stale_approval_on_settled_order',
        }),
      })
    );
  });

  it('reject_underpayment captured → refunds + files amount_stale review → 409 PAYPAL_AMOUNT_STALE (F-194)', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'reject_underpayment', captured: true },
      { id: 'PP-1', status: 'COMPLETED' } as never
    );
    const json = await res.json();

    expect(refundCapturedPaypalOrder).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(409);
    expect(json.code).toBe('PAYPAL_AMOUNT_STALE');
  });

  it('reject_underpayment not-captured → 409 without any refund', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'reject_underpayment', captured: false },
      undefined
    );
    expect(refundCapturedPaypalOrder).not.toHaveBeenCalled();
    expect(res.status).toBe(409);
  });

  it('capture_then_finalize but the captured set fails validation → refunds the charged funds + 400 (F4)', async () => {
    // Captured 1.00 USD but the stored presentment is 100 USD → validation
    // fails AFTER the buyer was charged. The funds must be refunded, not left
    // stranded behind a bare 400.
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: {
        id: 'PP-1',
        status: 'COMPLETED',
        links: [],
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAP-1',
                  status: 'COMPLETED',
                  amount: { value: '1.00', currency_code: 'USD' },
                },
              ],
            },
          },
        ],
      },
    } as never);

    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'capture_then_finalize' },
      undefined
    );

    expect(res.status).toBe(400);
    expect(refundCapturedPaypalOrder).toHaveBeenCalledTimes(1);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ stage: 'capture_amount_mismatch' }),
      })
    );
    expect(reconcilePaypalOrderToPaid).not.toHaveBeenCalled();
  });

  it('reconcile_completed_unpaid → settles via the writer', async () => {
    const res = await handlePaypalCaptureOutcome(
      ctxFixture(),
      { kind: 'reconcile_completed_unpaid' },
      { id: 'PP-1', status: 'COMPLETED' } as never
    );
    const json = await res.json();
    expect(settleCompletedPaypalOrder).toHaveBeenCalledTimes(1);
    expect(json.settled).toBe(true);
  });
});
