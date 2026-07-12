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
vi.mock('@/lib/payments/refund-duplicate-paypal-verify-capture', () => ({
  refundDuplicatePaypalCaptureOnVerify: (...args: unknown[]) =>
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

function paypalTransactionRowWithPlatformFee(
  status: string,
  platformFee: number
) {
  return { ...paypalTransactionRow(status), platform_fee: platformFee };
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
  });

  it('reconciles a completed PayPal transaction to a success response', async () => {
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRow('completed'),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
      orderUpdateData: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        customer_id: 'cust-1',
        total: 25,
        subtotal: 25,
        shipping_fee: 0,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '+1',
        shipping_address: {},
        currency: 'USD',
        shipping_status: 'processing',
        cancelled_at: null,
        order_items: [],
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest(REFERENCE));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      status: 'success',
      orderNumber: 'ORD-PP1',
    });
    // Never calls PayPal's API — verification is purely DB-state-driven.
    expect(mockVerifyPaystack).not.toHaveBeenCalled();
    expect(mockVerifyKorapay).not.toHaveBeenCalled();
    // Settles through the direct-to-merchant fork, never the legacy
    // wallet-crediting RPC — money already reached the merchant's own
    // PayPal account.
    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_merchant_settlement_v2',
      expect.objectContaining({
        p_gateway: 'paypal',
        p_settlement_type: 'direct_to_merchant',
      })
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.anything()
    );
  });

  it('forces zero platform fee for direct-to-merchant PayPal reconciliation', async () => {
    const supabase = buildSupabase({
      transactionRow: paypalTransactionRowWithPlatformFee('completed', 125),
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'unpaid',
        shipping_status: 'pending',
      },
      orderUpdateData: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        customer_id: 'cust-1',
        total: 25,
        subtotal: 25,
        shipping_fee: 0,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '+1',
        shipping_address: {},
        currency: 'USD',
        shipping_status: 'processing',
        cancelled_at: null,
        order_items: [],
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest(REFERENCE));

    expect(response.status).toBe(200);
    await vi.waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'record_merchant_settlement_v2',
        expect.objectContaining({
          p_gateway: 'paypal',
          p_platform_fee: 0,
          p_settlement_type: 'direct_to_merchant',
        })
      )
    );
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

  it('refunds a duplicate PayPal capture when a completed txn did NOT settle an already-paid order (Codex P1)', async () => {
    // completed PayPal txn, NO paypal_split on its metadata → it is not the
    // settler; the order is already paid (by another tender/PayPal order).
    mockRefundDuplicate.mockResolvedValue(
      NextResponse.json({
        success: true,
        status: 'success',
        orderNumber: 'ORD-PP1',
      })
    );
    const supabase = buildSupabase({
      transactionRow: {
        ...paypalTransactionRow('completed'),
        metadata: null,
        gateway_response: { purchase_units: [{ payments: { captures: [] } }] },
      },
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest(REFERENCE));

    expect(response.status).toBe(200);
    expect(mockRefundDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        orderId: 'order-1',
        transactionId: 'txn-paypal-1',
        gatewayReference: REFERENCE,
      })
    );
    // The duplicate is never settled/notified as a fresh payment.
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('does NOT refund when the completed PayPal txn IS the settler (paypal_split present) — idempotent success', async () => {
    const supabase = buildSupabase({
      transactionRow: {
        ...paypalTransactionRow('completed'),
        metadata: { paypal_split: { paypalResidualPaid: 25, prepaidPaid: 0 } },
        gateway_response: {},
      },
      existingOrder: {
        id: 'order-1',
        order_number: 'ORD-PP1',
        payment_status: 'paid',
        shipping_status: 'processing',
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest(REFERENCE));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, status: 'success' });
    expect(mockRefundDuplicate).not.toHaveBeenCalled();
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
    // The real platform fee (125) reaches the platform-rail settlement RPC —
    // it is NOT zeroed, and the paypal-only direct-to-merchant fork never runs.
    await vi.waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        'record_merchant_settlement',
        expect.objectContaining({
          p_gateway: 'korapay',
          p_platform_fee: 125,
        })
      )
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'record_merchant_settlement_v2',
      expect.anything()
    );
  });
});
