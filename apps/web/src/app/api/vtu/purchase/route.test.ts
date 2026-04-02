import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

// Kuda mock functions
const mockFormatPhoneNumber = vi.fn();
const mockIsValidPhoneNumber = vi.fn();
const mockGenerateRequestRef = vi.fn();
const mockPurchaseAirtime = vi.fn();
const mockPurchaseData = vi.fn();

vi.mock('@/lib/kuda', () => ({
  formatPhoneNumber: (...args: unknown[]) => mockFormatPhoneNumber(...args),
  isValidPhoneNumber: (...args: unknown[]) => mockIsValidPhoneNumber(...args),
  generateRequestRef: () => mockGenerateRequestRef(),
  purchaseAirtime: (...args: unknown[]) => mockPurchaseAirtime(...args),
  purchaseData: (...args: unknown[]) => mockPurchaseData(...args),
  NetworkProvider: {
    MTN: 'MTN',
    AIRTEL: 'AIRTEL',
    GLO: 'GLO',
    MOBILE_9: '9MOBILE',
  },
}));

const mockPurchaseBill = vi.fn();
vi.mock('@/lib/kuda-bills', () => ({
  purchaseBill: (...args: unknown[]) => mockPurchaseBill(...args),
}));

const mockCalculateCommerce = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  calculateCommerce: (...args: unknown[]) => mockCalculateCommerce(...args),
}));

// Supabase mock
let merchantData: unknown = null;
let merchantError: unknown = null;
let settingsData: Record<string, unknown> | null = null;
let settingsError: unknown = null;
let transactionData: unknown = null;
let transactionError: unknown = null;
let updateData: unknown = null;
let updateError: unknown = null;
let rpcData: unknown = null;
let rpcError: unknown = null;

function createMockSupabase() {
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  mockFrom.mockImplementation((table: string) => {
    if (table === 'merchants') {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: merchantData,
            error: merchantError,
          }),
        }),
      });
      return { select: mockSelect };
    }

    if (table === 'merchant_feature_settings') {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: settingsData,
            error: settingsError,
          }),
        }),
      });
      return { select: mockSelect };
    }

    if (table === 'vtu_transactions') {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: transactionData,
            error: transactionError,
          }),
        }),
      });

      mockEq.mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: updateData,
          error: updateError,
        }),
      });

      mockUpdate.mockReturnValue({ eq: mockEq });

      return {
        insert: mockInsert,
        update: mockUpdate,
      };
    }

    return { select: mockSelect };
  });

  mockRpc.mockResolvedValue({ data: rpcData, error: rpcError });

  return { from: mockFrom, rpc: mockRpc };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => createMockSupabase()),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

// ---- Helpers ----

const MERCHANT_ID = 'merchant-123';
const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/vtu/purchase', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- Tests ----

describe('POST /api/vtu/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock values
    merchantData = {
      id: MERCHANT_ID,
      business_name: 'Test Shop',
      bank_account_number: '1234567890',
      bank_code: '058',
      bank_account_name: 'Test Account',
    };
    merchantError = null;

    settingsData = {
      vtu_enabled: true,
      vtu_airtime_enabled: true,
      vtu_data_enabled: true,
      vtu_electricity_enabled: true,
      vtu_tv_enabled: true,
      vtu_betting_enabled: true,
      vtu_merchant_commission_rate: 0.5,
      vtu_customer_cashback_enabled: false,
      vtu_customer_cashback_rate: 50,
    };
    settingsError = null;

    transactionData = {
      id: 'tx-123',
      merchant_id: MERCHANT_ID,
      type: 'airtime',
      status: 'pending',
      metadata: {},
    };
    transactionError = null;

    updateData = null;
    updateError = null;

    rpcData = null;
    rpcError = null;

    // Mock function defaults
    mockFormatPhoneNumber.mockReturnValue('2348012345678');
    mockIsValidPhoneNumber.mockReturnValue(true);
    mockGenerateRequestRef.mockReturnValue('BACI-123456-abcd');
    mockCalculateCommerce.mockResolvedValue({
      merchantEarning: 10,
      platformEarning: 5,
    });
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      reference: 'ref-123',
      transactionId: 'tx-kuda-1',
      message: 'Purchase successful',
      status: 'successful',
      amount: 100,
    });
  });

  it('returns 400 for invalid input (bad schema)', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: '',
      amount: 10,
      type: 'invalid',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
  });

  it('returns 404 when merchant not found', async () => {
    const { POST } = await import('./route');
    merchantData = null;
    merchantError = { message: 'Not found' };

    const request = makeRequest({
      merchantSlug: 'nonexistent',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Merchant not found');
  });

  it('returns 403 when VTU disabled', async () => {
    const { POST } = await import('./route');
    settingsData = {
      ...settingsData,
      vtu_enabled: false,
    };

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('VTU is not enabled for this merchant');
  });

  it('returns 403 when specific type disabled (electricity)', async () => {
    const { POST } = await import('./route');
    settingsData = {
      ...settingsData,
      vtu_electricity_enabled: false,
    };

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 5000,
      type: 'electricity',
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '12345678901',
      billerName: 'Ikeja Electric',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Electricity purchases are not enabled');
  });

  it('returns 403 when data type disabled', async () => {
    const { POST } = await import('./route');
    settingsData = {
      ...settingsData,
      vtu_data_enabled: false,
    };

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 1000,
      type: 'data',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
      dataPlanCode: 'MTN-1GB',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Data purchases are not enabled');
  });

  it('returns 400 for invalid phone number on airtime', async () => {
    const { POST } = await import('./route');
    mockIsValidPhoneNumber.mockReturnValue(false);

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: 'invalid',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid phone number');
  });

  it('returns 400 for amount below minimum', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 40,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
  });

  it('returns 400 for amount above maximum', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 600000,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
  });

  it('returns successful purchase for airtime type', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
      source: 'direct',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Airtime purchase successful');
    expect(data.reference).toBe('BACI-123456-abcd');
    expect(data.transactionId).toBe('tx-kuda-1');
    expect(data.amount).toBe(100);
    expect(data.phoneNumber).toBe('2348012345678');
    expect(data.provider).toBe('MTN');
    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '2348012345678',
      100,
      'MTN',
      'Test Shop',
      'BACI-123456-abcd'
    );
  });

  it('returns successful purchase for data type', async () => {
    const { POST } = await import('./route');
    mockPurchaseData.mockResolvedValue({
      success: true,
      reference: 'ref-456',
      transactionId: 'tx-kuda-2',
      message: 'Data purchase successful',
      status: 'successful',
      amount: 1000,
    });

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 1000,
      type: 'data',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
      dataPlanCode: 'MTN-1GB',
      source: 'storefront_modal',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Data purchase successful');
    expect(mockPurchaseData).toHaveBeenCalledWith(
      '2348012345678',
      'MTN-1GB',
      1000,
      'MTN',
      'Test Shop',
      'BACI-123456-abcd'
    );
  });

  it('returns successful purchase for electricity (bill) type', async () => {
    const { POST } = await import('./route');
    mockPurchaseBill.mockResolvedValue({
      success: true,
      reference: 'ref-789',
      transactionId: 'tx-kuda-3',
      message: 'Electricity purchase successful',
      status: 'successful',
      amount: 5000,
    });

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 5000,
      type: 'electricity',
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '12345678901',
      billerName: 'Ikeja Electric',
      source: 'checkout',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Electricity purchase successful');
    expect(mockPurchaseBill).toHaveBeenCalledWith(
      'ikeja-electric-prepaid',
      '12345678901',
      5000,
      'Test Shop',
      'BACI-123456-abcd'
    );
  });

  it('returns 400 for data purchase without dataPlanCode', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 1000,
      type: 'data',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Data plan code is required for data purchases');
  });

  it('returns 400 for bill purchase without identifiers', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 5000,
      type: 'electricity',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
  });

  it('returns 500 when transaction creation fails', async () => {
    const { POST } = await import('./route');
    transactionError = { message: 'DB error' };

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to initiate purchase');
  });

  it('returns 400 when purchase fails', async () => {
    const { POST } = await import('./route');
    mockPurchaseAirtime.mockResolvedValue({
      success: false,
      reference: 'ref-fail',
      message: 'Insufficient balance',
      status: 'failed',
      amount: 100,
    });

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Insufficient balance');
    expect(data.reference).toBe('BACI-123456-abcd');
  });

  it('returns 500 on unexpected error', async () => {
    const { POST } = await import('./route');
    mockCalculateCommerce.mockRejectedValue(new Error('Unexpected error'));

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Purchase failed. Please try again.');
  });

  it('includes customer cashback when enabled', async () => {
    const { POST } = await import('./route');
    settingsData = {
      ...settingsData,
      vtu_customer_cashback_enabled: true,
      vtu_customer_cashback_rate: 50,
    };
    rpcData = [{ new_balance: 150 }];

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
      customerId: CUSTOMER_ID,
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cashback).toBeDefined();
    expect(data.cashback.amount).toBeGreaterThan(0);
  });

  it('formats phone number before validation', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    await POST(request);

    expect(mockFormatPhoneNumber).toHaveBeenCalledWith('08012345678');
    expect(mockIsValidPhoneNumber).toHaveBeenCalledWith('2348012345678');
  });

  it('calls calculateCommerce with correct parameters', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      merchantSlug: 'test-shop',
      amount: 100,
      type: 'airtime',
      phoneNumber: '08012345678',
      networkProvider: 'MTN',
    });
    await POST(request);

    expect(mockCalculateCommerce).toHaveBeenCalledWith('calculate_vtu', {
      amount: 100,
      provider: 'MTN',
      category: 'AIRTIME',
      merchantSplit: 50,
    });
  });
});
