import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Colocated tests for the PayPal branch of /api/payments/verify (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 item 8). PayPal v1
 * captures synchronously and has no webhook, so this route must verify from
 * the stored `transactions.status` instead of calling PayPal's API.
 */

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void Promise.resolve(callback()).catch(() => {
        // Ignore background task errors in tests.
      });
    },
  };
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() => Promise.resolve({ valid: true })),
}));

// PayPal never calls out to Paystack/Korapay, but the route imports both
// modules unconditionally at module scope — mock them so no env-dependent
// client gets constructed during these tests.
const mockVerifyPaystack = vi.fn();
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: (...args: unknown[]) => mockVerifyPaystack(...args),
}));

const mockVerifyKorapay = vi.fn();
vi.mock('@/lib/korapay', () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyKorapay(...args),
}));

const mockNotifyNewOrder = vi.fn();
const mockNotifyPaymentReceived = vi.fn();
vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: (...args: unknown[]) => mockNotifyNewOrder(...args),
  notifyPaymentReceived: (...args: unknown[]) =>
    mockNotifyPaymentReceived(...args),
}));

const mockSendEmail = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ success: true })
);
vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html />'),
  generateOrderConfirmationText: vi.fn(() => 'text'),
}));

vi.mock('@/lib/payments/verified-gateway-fee', () => ({
  extractVerifiedGatewayFeeNgn: vi.fn(() => 0),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const mockCreateServiceClient = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

const mockRefundDuplicate = vi.fn();
// /verify delegates every completed-PayPal decision to the one settlement funnel;
// the funnel's own suite covers what it decides.
const mockRunFunnel = vi.fn();
vi.mock('@/lib/payments/paypal-settlement-funnel', () => ({
  runPaypalReconcileFunnel: (...args: unknown[]) => mockRunFunnel(...args),
}));

const mockFinalizeOrderGatewayPayment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/payments/finalize-order-gateway-payment', () => ({
  finalizeOrderGatewayPayment: (...args: unknown[]) =>
    mockFinalizeOrderGatewayPayment(...args),
}));

vi.mock('@/lib/payments/refund-duplicate-paypal-capture', () => ({
  refundDuplicatePaypalCapture: (...args: unknown[]) =>
    mockRefundDuplicate(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      throw new Error(`Unexpected admin table: ${table}`);
    }),
  })),
}));

import { POST } from './route';

const REFERENCE = 'PAYPAL-ORDER-1';

function createRequest(reference: string) {
  return new NextRequest('http://localhost:3000/api/payments/verify', {
    body: JSON.stringify({ reference }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function paypalTransactionRow(status: string) {
  return {
    id: 'txn-paypal-1',
    order_id: 'order-1',
    merchant_id: 'merchant-1',
    amount: 25,
    currency: 'USD',
    status,
    gateway: 'paypal',
    gateway_reference: REFERENCE,
    platform_fee: 0,
    metadata: null as Record<string, unknown> | null,
    gateway_response: null as unknown,
  };
}

// A non-paypal (platform-rail) gateway: settlement must keep the real
// transaction.platform_fee — the direct-to-merchant zeroing is paypal-only.
function korapayTransactionRowWithPlatformFee(
  status: string,
  platformFee: number
) {
  return {
    id: 'txn-korapay-1',
    order_id: 'order-1',
    merchant_id: 'merchant-1',
    amount: 130000,
    currency: 'NGN',
    status,
    gateway: 'korapay',
    gateway_reference: REFERENCE,
    platform_fee: platformFee,
    metadata: null as Record<string, unknown> | null,
    gateway_response: null as unknown,
  };
}

function buildSupabase({
  transactionRow,
  existingOrder,
  orderUpdateData,
}: {
  transactionRow: ReturnType<typeof paypalTransactionRow> | null;
  existingOrder?: Record<string, unknown> | null;
  orderUpdateData?: Record<string, unknown>;
}) {
  const rpc = vi.fn().mockResolvedValue({ error: null });

  let transactionCall = 0;
  const from = vi.fn((table: string) => {
    if (table === 'transactions') {
      transactionCall++;
      if (transactionCall === 1) {
        // Lookup by gateway_reference.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: transactionRow, error: null }),
        };
      }
      // Claim update (only reached when verification.status === 'success').
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { id: 'txn-paypal-1' }, error: null }),
      };
    }
    if (table === 'orders') {
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: orderUpdateData ?? existingOrder ?? null,
          error: null,
        }),
        single: vi
          .fn()
          .mockResolvedValue({ data: orderUpdateData ?? null, error: null }),
      };
    }
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { business_name: 'Store', slug: 'store' },
          error: null,
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, rpc };
}

describe('POST /api/payments/verify — paypal branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinalizeOrderGatewayPayment.mockResolvedValue({
      healed: false,
      kind: 'completed',
      orderNumber: 'ORD-KP1',
    });
  });

  it('delegates a COMPLETED PayPal transaction to the single settlement funnel', async () => {
    // /verify no longer decides how to settle PayPal. Re-deriving that decision
    // here is exactly what let it drift from the capture route (it refunded real
    // payments, and silently passed stale cross-tender captures). It now hands the
    // question to the one funnel and returns its answer.
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRow('completed'),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);
    mockRunFunnel.mockResolvedValue({
      ok: true,
      response: NextResponse.json({
        success: true,
        status: 'success',
        orderNumber: 'ORD-PP1',
      }),
    });

    const response = await POST(createRequest(REFERENCE));
    const data = await response.json();

    expect(mockRunFunnel).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        merchantId: 'merchant-1',
        orderId: 'order-1',
      })
    );
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, orderNumber: 'ORD-PP1' });
    // Verification stays DB-state-driven; PayPal has no webhook to re-verify against.
    expect(mockVerifyPaystack).not.toHaveBeenCalled();
    expect(mockVerifyKorapay).not.toHaveBeenCalled();
  });

  it('surfaces the funnel verdict verbatim (e.g. a refunded duplicate or a rejected stale amount)', async () => {
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRow('completed'),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);
    mockRunFunnel.mockResolvedValue({
      ok: true,
      response: NextResponse.json(
        { error: 'The order total changed', code: 'PAYPAL_AMOUNT_STALE' },
        { status: 409 }
      ),
    });

    const response = await POST(createRequest(REFERENCE));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('PAYPAL_AMOUNT_STALE');
  });

  it('returns the funnel load error when the context cannot be loaded', async () => {
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRow('completed'),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);
    mockRunFunnel.mockResolvedValue({
      ok: false,
      status: 400,
      body: { error: 'Transaction is already in a non-pending state' },
    });

    const response = await POST(createRequest(REFERENCE));

    expect(response.status).toBe(400);
  });

  it('reports a still-pending PayPal capture as pending, not an error', async () => {
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRow('pending'),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest(REFERENCE));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: false,
      status: 'pending',
      orderNumber: 'ORD-PP1',
    });
    expect(mockVerifyPaystack).not.toHaveBeenCalled();
    expect(mockVerifyKorapay).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns the existing not-found behavior for an unknown reference', async () => {
    const supabase = buildSupabase({ transactionRow: null });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest('UNKNOWN-REF'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Transaction not found' });
  });

  it('passes a non-paypal gateway real platform fee through settlement (zeroing is paypal-only)', async () => {
    const supabase = buildSupabase({
      transactionRow: korapayTransactionRowWithPlatformFee('pending', 125),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-KP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
      orderUpdateData: {
        id: 'order-1',
        order_number: 'ORD-KP1',
        customer_id: 'cust-1',
        total: 130000,
        subtotal: 130000,
        shipping_fee: 0,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '+1',
        shipping_address: {},
        currency: 'NGN',
        shipping_status: 'processing',
        cancelled_at: null,
        order_items: [],
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);
    mockVerifyKorapay.mockResolvedValue({
      success: true,
      data: { status: 'success', reference: REFERENCE },
    });

    const response = await POST(createRequest(REFERENCE));

    expect(response.status).toBe(200);
    expect(mockVerifyKorapay).toHaveBeenCalled();
    // The real platform fee (125) reaches the shared platform-rail finalizer —
    // it is NOT zeroed by the PayPal-only direct-to-merchant path.
    expect(mockFinalizeOrderGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'korapay',
        transaction: expect.objectContaining({ platform_fee: 125 }),
      })
    );
  });
});
