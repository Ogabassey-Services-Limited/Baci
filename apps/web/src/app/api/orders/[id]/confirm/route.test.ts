import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
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
    mockCheckCsrfProtection: vi.fn(),
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
  checkCsrfProtection: mockCheckCsrfProtection,
}));

import { POST } from './route';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const MERCHANT_ID = 'merchant-123';

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(`https://usebaci.com/api/orders/${ORDER_ID}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

function createInsuranceDetails(overrides: Record<string, unknown> = {}) {
  return {
    imei: '123456789012345',
    serialNumber: 'SN-123',
    deviceColor: 'Black',
    deviceModel: 'iPhone 16 Pro',
    deviceMake: 'Apple',
    deviceType: 'Phone',
    deviceValue: 1_200_000,
    purchaseDate: '2026-06-15',
    devicePhotos: { about: 'https://cdn.usebaci.com/orders/device.jpg' },
    gender: 'Male',
    dateOfBirth: '1995-04-12',
    ...overrides,
  };
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
    mockPurchaseOrderInsurance.mockResolvedValue({ policyId: 'policy-1' });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
  });

  it('returns 401 before CSRF validation when authentication fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
    expect(mockGetMerchantIdForApiUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
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

    const response = await POST(
      createRequest(createInsuranceDetails()),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: 'Order confirmed successfully',
    });
    expect(mockReconciliationInsert).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).toHaveBeenCalledWith(
      ORDER_ID,
      expect.objectContaining({ imei: '123456789012345' }),
      // The route reuses its already-authorized client (Bearer-safe).
      expect.anything()
    );
  });

  it('surfaces insurance purchase failures after confirming the order', async () => {
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
    mockPurchaseOrderInsurance.mockRejectedValueOnce(
      new Error('MyCover wallet unavailable')
    );

    const response = await POST(
      createRequest(createInsuranceDetails()),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      insurance: null,
      insuranceError: 'MyCover wallet unavailable',
    });
  });

  it('rejects invalid insurance details before updating the order', async () => {
    const response = await POST(
      createRequest(
        createInsuranceDetails({
          devicePhotos: { about: 'not-a-url' },
        })
      ),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid insurance details' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const request = new NextRequest(
      `https://usebaci.com/api/orders/${ORDER_ID}/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ not valid json',
      }
    );

    const response = await POST(request, createParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid request body' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('rejects invalid route ids before updating the order', async () => {
    const response = await POST(
      createRequest(createInsuranceDetails()),
      createParams('not-a-valid-order-id')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid order id' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('rejects insurance details with missing KYC (gender / date of birth)', async () => {
    const {
      gender: _g,
      dateOfBirth: _d,
      ...withoutKyc
    } = createInsuranceDetails();

    const response = await POST(createRequest(withoutKyc), createParams());

    expect(response.status).toBe(400);
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('rejects insurance details with a future date of birth', async () => {
    const response = await POST(
      createRequest(createInsuranceDetails({ dateOfBirth: '3000-01-01' })),
      createParams()
    );

    expect(response.status).toBe(400);
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('rejects insurance details with a normalized invalid calendar date', async () => {
    const response = await POST(
      createRequest(createInsuranceDetails({ dateOfBirth: '2025-02-31' })),
      createParams()
    );

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
  });

  it('rejects insurance details with today as date of birth', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const response = await POST(
      createRequest(createInsuranceDetails({ dateOfBirth: today })),
      createParams()
    );

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
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

    const response = await POST(
      createRequest(createInsuranceDetails()),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Order was cancelled and cannot be confirmed',
      code: 'ORDER_CANCELLED',
    });
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
    // The reconciliation row is filed through the service-role admin client.
    expect(mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: ORDER_ID,
      })
    );
  });

  it('returns 404 when the update matches no order row', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return createOrdersTable(null);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(createRequest(), createParams());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Order not found' });
    expect(mockPurchaseOrderInsurance).not.toHaveBeenCalled();
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
