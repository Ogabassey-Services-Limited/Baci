import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrder } from '@/lib/paypal';
import type { PaypalCaptureContext } from './paypal-capture-execute';
import { handlePaypalCaptureOutcome } from './paypal-capture-outcome-handlers';
import { resolveAndDispatchPaypalSettlement } from './paypal-settlement-funnel';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paypal', () => ({ getOrder: vi.fn() }));

vi.mock('./paypal-capture-outcome-handlers', () => ({
  handlePaypalCaptureOutcome: vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 200 })),
}));

vi.mock('./paypal-checkout-credentials', () => ({
  getPaypalCheckoutCredentials: vi.fn(),
  readPaypalFeatureConfig: vi.fn(),
}));

vi.mock('./load-paypal-capture-context', () => ({
  loadPaypalCaptureContext: vi.fn(),
  orderNumberFallback: (id: string) => id.slice(0, 8).toUpperCase(),
}));

function ctx(overrides?: {
  txnStatus?: string;
  paymentStatus?: string;
  paidTransactionId?: string | null;
}): PaypalCaptureContext {
  return {
    supabase: {} as never,
    merchantId: 'm1',
    orderId: 'o1',
    paypalOrderId: 'PP-1',
    environment: 'live',
    mode: 'live',
    credentials: { clientId: 'c', secretKey: 's' },
    transaction: {
      id: 'txn-1',
      order_id: 'o1',
      merchant_id: 'm1',
      amount: 100,
      currency: 'USD',
      status: overrides?.txnStatus ?? 'pending',
      metadata: null,
      platform_fee: 0,
    },
    orderSnapshot: {
      id: 'o1',
      merchant_id: 'm1',
      total: 100,
      currency: 'USD',
      customer_email: 'c@e.com',
      order_number: 'BACI-1',
      shipping_status: 'pending',
      payment_status: overrides?.paymentStatus ?? 'unpaid',
      amount_paid: 0,
      paid_transaction_id: overrides?.paidTransactionId ?? null,
    },
    orderTotal: 100,
    lockedResidual: 100,
    currentResidual: 100,
    presentmentAmount: 100,
    presentmentCurrency: 'USD',
  } as PaypalCaptureContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveAndDispatchPaypalSettlement', () => {
  it('capture intent: an unpaid, capturable order dispatches capture_then_finalize', async () => {
    await resolveAndDispatchPaypalSettlement(ctx(), 'capture');

    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'capture_then_finalize' },
      undefined
    );
    // A plainly-unpaid order captures optimistically — no live lookup needed.
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('reconcile_only NEVER charges: a capturable order returns PAYPAL_NOT_CAPTURED instead of dispatching a capture', async () => {
    // Nothing was captured at PayPal, so there is nothing to reconcile. /verify
    // and create-order must not turn that into a charge.
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-1', status: 'APPROVED' },
    } as never);

    const res = await resolveAndDispatchPaypalSettlement(
      ctx(),
      'reconcile_only'
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe('PAYPAL_NOT_CAPTURED');
    expect(handlePaypalCaptureOutcome).not.toHaveBeenCalled();
  });

  it('reconcile_only always establishes the live status rather than assuming APPROVED', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-1', status: 'COMPLETED' },
    } as never);

    await resolveAndDispatchPaypalSettlement(ctx(), 'reconcile_only');

    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'reconcile_completed_unpaid' },
      expect.objectContaining({ status: 'COMPLETED' })
    );
  });

  it('a completed transaction short-circuits the live lookup (no PayPal call on the verify poll path)', async () => {
    await resolveAndDispatchPaypalSettlement(
      ctx({ txnStatus: 'completed', paymentStatus: 'unpaid' }),
      'reconcile_only'
    );

    expect(getOrder).not.toHaveBeenCalled();
    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'reconcile_completed_unpaid' },
      undefined
    );
  });

  it('paid by a DIFFERENT txn → dispatches block_paid_elsewhere with other_txn (refundable duplicate)', async () => {
    await resolveAndDispatchPaypalSettlement(
      ctx({
        txnStatus: 'completed',
        paymentStatus: 'paid',
        paidTransactionId: 'someone-else',
      }),
      'reconcile_only'
    );

    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'block_paid_elsewhere',
        captured: true,
        settlerVerdict: 'other_txn',
      },
      undefined
    );
  });

  it('paid with NO settler marker → blocks with unknown so the handler escalates instead of refunding', async () => {
    // This is the cross-tender case: an order paid by Paystack/Korapay never
    // stamps paid_transaction_id, so a stale PayPal capture lands here. It must
    // be escalated, never auto-refunded, and never reported as clean success.
    await resolveAndDispatchPaypalSettlement(
      ctx({
        txnStatus: 'completed',
        paymentStatus: 'paid',
        paidTransactionId: null,
      }),
      'reconcile_only'
    );

    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'block_paid_elsewhere',
        captured: true,
        settlerVerdict: 'unknown',
      },
      undefined
    );
  });

  it('paid by THIS txn → idempotent success', async () => {
    await resolveAndDispatchPaypalSettlement(
      ctx({
        txnStatus: 'completed',
        paymentStatus: 'paid',
        paidTransactionId: 'txn-1',
      }),
      'reconcile_only'
    );

    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'already_paid_idempotent' },
      undefined
    );
  });
});
