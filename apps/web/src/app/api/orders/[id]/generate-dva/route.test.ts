import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock environment variables
vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Hoist mock references for vi.mock factories
const {
  mockAuthenticateApiRequest,
  mockGetMerchantIdForApiUser,
  mockCreateDedicatedVirtualAccount,
  mockFrom,
  mockRpc,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ error: null });
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockGetMerchantIdForApiUser: vi.fn(),
    mockCreateDedicatedVirtualAccount: vi.fn(),
    mockFrom,
    mockRpc,
    mockSupabaseClient: {
      auth: { getUser: vi.fn() },
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

// Mock API auth
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
}));

// Mock agentic paystack (createDedicatedVirtualAccount)
vi.mock('@/lib/agentic/paystack', () => ({
  createDedicatedVirtualAccount: mockCreateDedicatedVirtualAccount,
}));

// Mock Paystack (calculatePlatformFee only)
vi.mock('@/lib/paystack', () => ({
  calculatePlatformFee: vi.fn((amountKobo: number) => ({
    platformFee: Math.min((amountKobo * 2) / 100, 205000),
    merchantAmount: amountKobo - Math.min((amountKobo * 2) / 100, 205000),
    total: amountKobo,
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { POST } from './route';

const ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MERCHANT_ID = 'merchant-123';

function createRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/orders/${ORDER_ID}/generate-dva`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function createParams() {
  return { params: Promise.resolve({ id: ORDER_ID }) };
}

// Helper to chain Supabase query methods
function mockQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('POST /api/orders/[id]/generate-dva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(401);
  });

  it('returns 404 when merchant not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(null);

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 404 when order not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);

    const orderQuery = mockQuery(null, {
      code: 'PGRST116',
      message: 'Not found',
    });
    mockFrom.mockReturnValue(orderQuery);

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(404);
  });

  it('returns 400 when order is already paid', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);

    const orderQuery = mockQuery({
      id: ORDER_ID,
      order_number: 'ORD-001',
      total: '5000',
      customer_name: 'John Doe',
      customer_email: 'john@test.com',
      customer_phone: '+2348012345678',
      payment_status: 'paid',
      merchant_id: MERCHANT_ID,
    });
    mockFrom.mockReturnValue(orderQuery);

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Order is already paid');
  });

  it('returns existing DVA when one already exists', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return mockQuery({
          id: ORDER_ID,
          order_number: 'ORD-001',
          total: '5000',
          customer_name: 'John Doe',
          customer_email: 'john@test.com',
          customer_phone: '+2348012345678',
          payment_status: 'unpaid',
          merchant_id: MERCHANT_ID,
        });
      }
      if (table === 'order_payment_accounts') {
        callCount++;
        if (callCount === 1) {
          return mockQuery({
            account_number: '1234567890',
            bank_name: 'Wema Bank',
            account_name: 'John Doe',
          });
        }
      }
      return mockQuery(null);
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.existing).toBe(true);
    expect(body.virtualAccount.account_number).toBe('1234567890');
  });

  it('creates new Paystack DVA and returns details', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return mockQuery({
          id: ORDER_ID,
          order_number: 'ORD-001',
          total: '5000',
          customer_name: 'John Doe',
          customer_email: 'john@test.com',
          customer_phone: '+2348012345678',
          payment_status: 'unpaid',
          merchant_id: MERCHANT_ID,
        });
      }
      if (table === 'order_payment_accounts') {
        return mockQuery(null, null);
      }
      return mockQuery(null);
    });

    mockCreateDedicatedVirtualAccount.mockResolvedValue({
      account_number: '9876543210',
      account_name: 'JOHN DOE',
      bank_name: 'Wema Bank',
      currency: 'NGN',
      assigned: true,
    });

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.existing).toBe(false);
    expect(body.virtualAccount.account_number).toBe('9876543210');
    expect(body.virtualAccount.bank_name).toBe('Wema Bank');

    // Verify createDedicatedVirtualAccount was called with correct data
    expect(mockCreateDedicatedVirtualAccount).toHaveBeenCalledWith({
      email: 'john@test.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+2348012345678',
    });

    // Verify transaction record was created
    expect(mockRpc).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_merchant_id: MERCHANT_ID,
        p_order_id: ORDER_ID,
        p_gateway: 'paystack',
      })
    );
  });

  it('returns 500 when Paystack DVA creation throws', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabaseClient,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(MERCHANT_ID);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return mockQuery({
          id: ORDER_ID,
          order_number: 'ORD-001',
          total: '5000',
          customer_name: 'John Doe',
          customer_email: 'john@test.com',
          customer_phone: '+2348012345678',
          payment_status: 'unpaid',
          merchant_id: MERCHANT_ID,
        });
      }
      if (table === 'order_payment_accounts') {
        return mockQuery(null, null);
      }
      return mockQuery(null);
    });

    mockCreateDedicatedVirtualAccount.mockRejectedValue(
      new Error('Failed to assign DVA: wema-bank and titan-paycom both failed')
    );

    const response = await POST(createRequest(), createParams());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Failed to assign DVA');
  });
});
