import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockCreateSubaccount,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  mockResolveAccountNumber,
  mockToUserAccess,
  mockUpdateSubaccount,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockCreateSubaccount: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockHasPermission: vi.fn(),
  mockResolveAccountNumber: vi.fn(),
  mockToUserAccess: vi.fn(),
  mockUpdateSubaccount: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('@/lib/paystack', () => ({
  createSubaccount: (...args: unknown[]) => mockCreateSubaccount(...args),
  resolveAccountNumber: (...args: unknown[]) =>
    mockResolveAccountNumber(...args),
  updateSubaccount: (...args: unknown[]) => mockUpdateSubaccount(...args),
}));

import { POST } from './route';

function makeRequest(
  body: string | Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new Request('http://localhost/api/paystack/subaccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/paystack/subaccount', () => {
  const mockMerchantSingle = vi.fn();
  const mockMerchantUpdateEq = vi.fn();
  const mockMerchantUpdate = vi.fn(() => ({ eq: mockMerchantUpdateEq }));
  const mockMerchantSelectEq = vi.fn(() => ({ single: mockMerchantSingle }));
  const mockMerchantSelect = vi.fn(() => ({ eq: mockMerchantSelectEq }));
  const mockSupabase = {
    from: vi.fn(() => ({
      select: mockMerchantSelect,
      update: mockMerchantUpdate,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase.from.mockImplementation(() => ({
      select: mockMerchantSelect,
      update: mockMerchantUpdate,
    }));

    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123', email: 'owner@example.com' },
      error: null,
      supabase: mockSupabase,
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-456',
      staffAccess: { role: 'owner', isOwner: true, isStaff: false },
    });
    mockToUserAccess.mockReturnValue({
      merchantId: 'merchant-456',
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: {},
    });
    mockHasPermission.mockReturnValue(true);
    mockMerchantSingle.mockResolvedValue({
      data: {
        paystack_subaccount_code: null,
        business_name: 'Baci Store',
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });
    mockMerchantUpdateEq.mockResolvedValue({ error: null });
    mockResolveAccountNumber.mockResolvedValue({
      success: true,
      data: {
        account_name: 'Jane Doe',
        account_number: '1234567890',
      },
    });
    mockCreateSubaccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: 'ACCT_new123' },
    });
    mockUpdateSubaccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: 'ACCT_existing123' },
    });
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not authenticated' });
  });

  it('enforces CSRF for cookie-authenticated requests', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Invalid CSRF token' });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('skips CSRF for bearer-authenticated requests', async () => {
    const response = await POST(
      makeRequest(
        {
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        },
        { Authorization: 'Bearer token-123' }
      )
    );

    expect(response.status).toBe(200);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant context is missing', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller lacks integrations permission', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await POST(makeRequest('not valid json{{{'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid JSON in request body',
    });
  });

  it('returns 400 when the request payload is invalid', async () => {
    const response = await POST(
      makeRequest({ accountNumber: '123', bankCode: '044' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid input');
  });

  it('uses the merchant record business name when the payload omits it', async () => {
    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );

    expect(response.status).toBe(200);
    expect(mockCreateSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: 'Baci Store' })
    );
  });

  it('returns 400 when neither the payload nor merchant record has a business name', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        paystack_subaccount_code: null,
        business_name: null,
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });

    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Business name is required',
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
  });

  it('creates a new subaccount and persists the resolved details', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        payoutMode: 'weekly',
        autoPayoutEnabled: true,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Jane Doe',
      subaccountCode: 'ACCT_new123',
    });
    expect(mockResolveAccountNumber).toHaveBeenCalledWith('1234567890', '044');
    expect(mockCreateSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Baci Store',
        settlement_bank: '044',
        account_number: '1234567890',
      })
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith({
      paystack_subaccount_code: 'ACCT_new123',
      bank_account_number: '1234567890',
      bank_code: '044',
      bank_name: 'Unknown Bank',
      payout_mode: 'weekly',
      auto_payout_enabled: true,
    });
  });

  it('updates an existing subaccount instead of creating a new one', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        paystack_subaccount_code: 'ACCT_existing123',
        business_name: 'Baci Store',
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(200);
    expect(mockUpdateSubaccount).toHaveBeenCalledWith(
      'ACCT_existing123',
      expect.objectContaining({
        business_name: 'Baci Store',
        settlement_bank: '044',
        account_number: '1234567890',
      })
    );
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
  });

  it('accepts an alphanumeric bankCode (MFB50992) and reaches resolveAccountNumber', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: 'MFB50992',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(200);
    expect(mockResolveAccountNumber).toHaveBeenCalledWith(
      '1234567890',
      'MFB50992'
    );
  });

  it('maps configuration failures to 500', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: false,
      error: 'PAYSTACK_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Service configuration error',
    });
  });

  it('maps upstream subaccount failures to 502', async () => {
    mockCreateSubaccount.mockResolvedValueOnce({
      success: false,
      error: 'Gateway timeout',
      code: 'HTTP_502',
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Gateway timeout' });
  });
});
