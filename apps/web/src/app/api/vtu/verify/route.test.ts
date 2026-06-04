import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

interface VerifyResult {
  verified: boolean;
  message: string;
  customerName?: string;
  accountNumber?: string;
  address?: string;
}

let mockVerifyBillCustomer = vi.fn();
let mockMonnifyVerifyBillCustomer = vi.fn();

vi.mock('@/lib/kuda-bills', () => ({
  verifyBillCustomer: (...args: unknown[]) => mockVerifyBillCustomer(...args),
}));

vi.mock('@/lib/monnify-bills', () => ({
  verifyBillCustomer: (...args: unknown[]) =>
    mockMonnifyVerifyBillCustomer(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

// ---- Helpers ----

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/vtu/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- Tests ----

describe('POST /api/vtu/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyBillCustomer = vi.fn().mockResolvedValue({
      verified: true,
      message: 'Customer verified',
      customerName: 'John Doe',
      accountNumber: '1234567890',
    });
    mockMonnifyVerifyBillCustomer = vi.fn().mockResolvedValue({
      verified: true,
      message: 'Monnify customer verified',
      customerName: 'John Doe Monnify',
      validationReference: 'VAL-MON-123',
    });
  });

  it('returns verified result for valid input', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data: VerifyResult = await response.json();

    expect(response.status).toBe(200);
    expect(data.verified).toBe(true);
    expect(data.message).toBe('Customer verified');
    expect(data.customerName).toBe('John Doe');
    expect(mockVerifyBillCustomer).toHaveBeenCalledWith(
      'ikeja-electric-prepaid',
      '12345678901'
    );
  });

  it('returns unverified result when customer not found', async () => {
    const { POST } = await import('./route');
    mockVerifyBillCustomer.mockResolvedValue({
      verified: false,
      message: 'Invalid meter number',
    });

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '99999999999',
    });
    const response = await POST(request);
    const data: VerifyResult = await response.json();

    expect(response.status).toBe(200);
    expect(data.verified).toBe(false);
    expect(data.message).toBe('Invalid meter number');
  });

  it('returns 400 for missing billItemIdentifier', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 for missing customerIdentifier', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-prepaid',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 for empty billItemIdentifier', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      billItemIdentifier: '',
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 for empty customerIdentifier', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 for missing both fields', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 500 when verifyBillCustomer throws', async () => {
    const { POST } = await import('./route');
    mockVerifyBillCustomer.mockRejectedValue(new Error('Kuda API unavailable'));

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-prepaid',
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.verified).toBe(false);
    expect(data.message).toBe('Verification failed. Please try again.');
  });

  it('passes correct parameters to verifyBillCustomer', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      billItemIdentifier: 'dstv-compact-plus',
      customerIdentifier: '9876543210',
    });
    await POST(request);

    expect(mockVerifyBillCustomer).toHaveBeenCalledTimes(1);
    expect(mockVerifyBillCustomer).toHaveBeenCalledWith(
      'dstv-compact-plus',
      '9876543210'
    );
  });

  it('handles network error gracefully', async () => {
    const { POST } = await import('./route');
    mockVerifyBillCustomer.mockRejectedValue(new Error('Network timeout'));

    const request = makeRequest({
      billItemIdentifier: 'gotv-max',
      customerIdentifier: '1111222233',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.verified).toBe(false);
    expect(data.message).toBe('Verification failed. Please try again.');
  });

  it('returns full customer details when verification succeeds', async () => {
    const { POST } = await import('./route');
    mockVerifyBillCustomer.mockResolvedValue({
      verified: true,
      message: 'Verification successful',
      customerName: 'Jane Smith',
      accountNumber: '5555666677',
      address: '123 Main St, Lagos',
    });

    const request = makeRequest({
      billItemIdentifier: 'ikeja-electric-postpaid',
      customerIdentifier: '5555666677',
    });
    const response = await POST(request);
    const data: VerifyResult = await response.json();

    expect(response.status).toBe(200);
    expect(data.verified).toBe(true);
    expect(data.customerName).toBe('Jane Smith');
    expect(data.accountNumber).toBe('5555666677');
    expect(data.address).toBe('123 Main St, Lagos');
  });

  it('calls monnify validation when provider is monnify', async () => {
    const { POST } = await import('./route');

    mockMonnifyVerifyBillCustomer.mockResolvedValue({
      verified: true,
      message: 'Monnify customer verified',
      customerName: 'Alice Smith',
      validationReference: 'MON-VAL-REF',
    });

    const request = makeRequest({
      provider: 'monnify',
      billerCode: 'IKEDC',
      productCode: 'IKEDC-PREPAID',
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.verified).toBe(true);
    expect(data.customerName).toBe('Alice Smith');
    expect(data.validationReference).toBe('MON-VAL-REF');
    expect(mockMonnifyVerifyBillCustomer).toHaveBeenCalledWith(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678901'
    );
    expect(mockVerifyBillCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 when monnify provider lacks billerCode', async () => {
    const { POST } = await import('./route');

    const request = makeRequest({
      provider: 'monnify',
      productCode: 'IKEDC-PREPAID',
      customerIdentifier: '12345678901',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(mockMonnifyVerifyBillCustomer).not.toHaveBeenCalled();
  });
});
