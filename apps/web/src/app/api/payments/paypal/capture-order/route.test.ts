import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPaypalCaptureContext } from '@/lib/payments/load-paypal-capture-context';
import { handlePaypalCaptureOutcome } from '@/lib/payments/paypal-capture-outcome-handlers';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { getOrder } from '@/lib/paypal';
import { createServiceClient } from '@/lib/supabase/service';
import { POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

vi.mock('@/lib/paypal', () => ({
  getOrder: vi.fn(),
}));

vi.mock('@/lib/payments/load-paypal-capture-context', () => ({
  loadPaypalCaptureContext: vi.fn(),
  orderNumberFallback: (id: string) => id.slice(0, 8).toUpperCase(),
}));

vi.mock('@/lib/payments/paypal-capture-outcome-handlers', () => ({
  handlePaypalCaptureOutcome: vi.fn(),
}));

vi.mock('@/lib/payments/paypal-checkout-credentials', () => ({
  getPaypalCheckoutCredentials: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';
const PAYPAL_ORDER_ID = 'PP-ORD-1';

const META = {
  customer_email: 'customer@example.com',
  paypal_mode: 'live',
  paypal_presentment_amount: 100,
  paypal_presentment_currency: 'USD',
};

function transaction(status = 'pending') {
  return {
    id: 'txn-1',
    order_id: ORDER_ID,
    merchant_id: MERCHANT_ID,
    amount: 130000,
    currency: 'NGN',
    status,
    metadata: META,
    platform_fee: 0,
  };
}

function orderSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    merchant_id: MERCHANT_ID,
    total: 130000,
    currency: 'NGN',
    customer_email: 'customer@example.com',
    order_number: 'BACI-1002',
    shipping_status: 'pending',
    payment_status: 'unpaid',
    amount_paid: 0,
    paid_transaction_id: null,
    ...overrides,
  };
}

function loadOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    transaction: transaction(),
    orderSnapshot: orderSnapshot(),
    metadata: META,
    lockedResidual: 100000,
    currentResidual: 100000,
    presentmentAmount: 100,
    presentmentCurrency: 'USD',
    ...overrides,
  } as never;
}

function request() {
  return new NextRequest('http://localhost/api/payments/paypal/capture-order', {
    method: 'POST',
    body: JSON.stringify({
      order_id: ORDER_ID,
      paypal_order_id: PAYPAL_ORDER_ID,
      merchant_id: MERCHANT_ID,
      customer_email: 'customer@example.com',
    }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceClient).mockReturnValue({} as never);
  vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue({
    clientId: 'cid',
    secretKey: 'sec',
  });
  vi.mocked(handlePaypalCaptureOutcome).mockImplementation(
    async (_ctx, outcome) =>
      new Response(JSON.stringify({ dispatched: outcome.kind }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }) as never
  );
});

describe('POST /api/payments/paypal/capture-order (funnel dispatch)', () => {
  it('400s on an invalid body', async () => {
    const res = await POST(
      new NextRequest('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns the loader error verbatim', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue({
      ok: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    });
    const res = await POST(request());
    expect(res.status).toBe(404);
  });

  it('rejects a non-live (sandbox) order before touching PayPal', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      loadOk({ metadata: { ...META, paypal_mode: 'sandbox' } })
    );
    const res = await POST(request());
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe('PAYPAL_SANDBOX_NOT_ALLOWED');
  });

  it('400s PAYPAL_NOT_CONFIGURED when the vault has no credentials', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(loadOk());
    vi.mocked(getPaypalCheckoutCredentials).mockResolvedValue(null);
    const res = await POST(request());
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe('PAYPAL_NOT_CONFIGURED');
  });

  it('unpaid + pending → captures optimistically (capture_then_finalize), no getOrder', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(loadOk());
    const res = await POST(request());
    const json = await res.json();
    expect(json.dispatched).toBe('capture_then_finalize');
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('completed txn → reconcile_completed_unpaid without re-fetching PayPal', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      loadOk({ transaction: transaction('completed') })
    );
    const res = await POST(request());
    const json = await res.json();
    expect(json.dispatched).toBe('reconcile_completed_unpaid');
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('paid-elsewhere order + captured stale PayPal order → looks up status and blocks (F-203)', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      loadOk({ orderSnapshot: orderSnapshot({ payment_status: 'paid' }) })
    );
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: PAYPAL_ORDER_ID, status: 'COMPLETED' },
    } as never);

    const res = await POST(request());
    const json = await res.json();

    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(json.dispatched).toBe('block_paid_elsewhere');
    // No settler marker on the order → `unknown`. It still blocks the capture,
    // but the verdict must ride along so the handler does NOT auto-refund what
    // could be a legitimate payment (Codex pass-9 P1).
    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'block_paid_elsewhere',
        captured: true,
        settlerVerdict: 'unknown',
      },
      expect.objectContaining({ status: 'COMPLETED' })
    );
  });

  it('paid by a PROVABLY different txn + captured stale PayPal order → blocks with other_txn (auto-refundable duplicate)', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      loadOk({
        orderSnapshot: orderSnapshot({
          payment_status: 'paid',
          paid_transaction_id: 'a-different-transaction-id',
        }),
      })
    );
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: PAYPAL_ORDER_ID, status: 'COMPLETED' },
    } as never);

    await POST(request());

    expect(handlePaypalCaptureOutcome).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'block_paid_elsewhere',
        captured: true,
        settlerVerdict: 'other_txn',
      },
      expect.objectContaining({ status: 'COMPLETED' })
    );
  });

  it('unpaid + pending + stale (raised) total → rejects underpayment BEFORE capture (F-194)', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      loadOk({ lockedResidual: 100000, currentResidual: 130000 })
    );
    const res = await POST(request());
    const json = await res.json();
    expect(json.dispatched).toBe('reject_underpayment');
    expect(getOrder).not.toHaveBeenCalled();
  });
});
