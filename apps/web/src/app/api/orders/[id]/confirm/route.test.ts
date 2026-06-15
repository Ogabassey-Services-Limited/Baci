import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockPurchaseOrderInsurance,
  mockFrom,
  mockLogger,
  mockSupabaseClient,
  mockReconciliationInsert,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockGetMerchantIdForApiUser: vi.fn(),
    mockPurchaseOrderInsurance: vi.fn(),
    mockFrom,
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockSupabaseClient: { from: mockFrom },
    // handlePaymentForCancelledOrder now files the reconciliation row through a
    // service-role admin client (reconciliation_review is RLS-locked to
    // service_role), not the route's own auth client.
    mockReconciliationInsert: vi
      .fn()
      .mockResolvedValue({ data: null, error: null }),
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'reconciliation_review') {
        return { insert: mockReconciliationInsert };
      }
      throw new Error(`Unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock('@/services/insurance', () => ({
  purchaseOrderInsurance: mockPurchaseOrderInsurance,
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

import { POST } from './route';

const ORDER_ID = 'order-123';
const MERCHANT_ID = 'merchant-123';

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(`https://usebaci.com/api/orders/${ORDER_ID}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams() {
  return { params: Promise.resolve({ id: ORDER_ID }) };
}

function createOrdersTable(updatedOrder: Record<string, unknown> | null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: updatedOrder, error: null }),
  };
}

describe('POST /api/orders/[id]/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);
  });

  it('confirms the order when the update advances shipping to processing', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return createOrdersTable({
          id: ORDER_ID,
          shipping_status: 'processing',
          cancelled_at: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: 'Order confirmed successfully',
    });
    expect(mockReconciliationInsert).not.toHaveBeenCalled();
  });

  it('files reconciliation and rejects with 409 when the order was clamped as cancelled', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return createOrdersTable({
          id: ORDER_ID,
          shipping_status: 'cancelled',
          cancelled_at: '2026-06-15T00:00:00Z',
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Order was cancelled and cannot be confirmed',
      code: 'ORDER_CANCELLED',
    });
    // The reconciliation row is filed through the service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: ORDER_ID,
      })
    );
  });

  it('returns 500 when the order update fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'boom' } }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update order status' });
  });
});
