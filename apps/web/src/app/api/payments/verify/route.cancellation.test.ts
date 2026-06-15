import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockVerifyPaystack = vi.fn();
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: (...args: unknown[]) => mockVerifyPaystack(...args),
}));

vi.mock('@/lib/korapay', () => ({
  verifyPayment: vi.fn(),
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

import { POST } from './route';

const REFERENCE = 'BAC-VERIFY-1';

function createRequest() {
  return new NextRequest('http://localhost:3000/api/payments/verify', {
    body: JSON.stringify({ reference: REFERENCE }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

const transactionRow = {
  id: 'txn-1',
  order_id: 'order-1',
  merchant_id: 'merchant-1',
  amount: 1000,
  currency: 'NGN',
  status: 'pending',
  gateway: 'paystack',
  gateway_reference: REFERENCE,
  platform_fee: 0,
};

function buildSupabase({
  orderUpdateData,
}: {
  orderUpdateData: Record<string, unknown>;
}) {
  const reconciliationInsert = vi
    .fn()
    .mockResolvedValue({ data: null, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });

  let transactionCall = 0;
  const from = vi.fn((table: string) => {
    if (table === 'transactions') {
      transactionCall++;
      if (transactionCall === 1) {
        // lookup by gateway_reference
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: transactionRow, error: null }),
        };
      }
      // claim update
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { id: 'txn-1' }, error: null }),
      };
    }
    if (table === 'orders') {
      // First a pre-fetch (maybeSingle) then the update (single).
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'order-1',
            order_number: 'ORD-1',
            payment_status: 'unpaid',
            shipping_status: 'pending',
          },
          error: null,
        }),
        single: vi
          .fn()
          .mockResolvedValue({ data: orderUpdateData, error: null }),
      };
    }
    if (table === 'reconciliation_review') {
      return { insert: reconciliationInsert };
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

  return { from, rpc, reconciliationInsert };
}

describe('POST /api/payments/verify — cancellation clamp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPaystack.mockResolvedValue({
      success: true,
      data: { status: 'success', amount: 100_000, currency: 'NGN' },
    });
  });

  it('suppresses paid-order side effects and files reconciliation when the order is clamped as cancelled', async () => {
    const supabase = buildSupabase({
      orderUpdateData: {
        id: 'order-1',
        order_number: 'ORD-1',
        customer_id: 'cust-1',
        total: 1000,
        subtotal: 1000,
        shipping_fee: 0,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '+234',
        shipping_address: {},
        currency: 'NGN',
        shipping_status: 'cancelled',
        cancelled_at: '2026-06-15T00:00:00Z',
        order_items: [],
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, status: 'success' });
    // No paid-order side effects fired.
    expect(mockNotifyNewOrder).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.anything()
    );
    // Reconciliation row filed.
    expect(supabase.reconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: 'order-1',
      })
    );
  });

  it('fires paid-order side effects when the order is NOT cancelled', async () => {
    const supabase = buildSupabase({
      orderUpdateData: {
        id: 'order-1',
        order_number: 'ORD-1',
        customer_id: 'cust-1',
        total: 1000,
        subtotal: 1000,
        shipping_fee: 0,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '+234',
        shipping_address: {},
        currency: 'NGN',
        shipping_status: 'processing',
        cancelled_at: null,
        order_items: [],
      },
    });
    mockCreateServiceClient.mockReturnValue(supabase);

    const response = await POST(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect(supabase.reconciliationInsert).not.toHaveBeenCalled();
    // The new-order push notification fires for a live order.
    expect(mockNotifyNewOrder).toHaveBeenCalled();
  });
});
