import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  mockResolveAccountNumber,
  mockToUserAccess,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockHasPermission: vi.fn(),
  mockResolveAccountNumber: vi.fn(),
  mockToUserAccess: vi.fn(),
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
  resolveAccountNumber: (...args: unknown[]) =>
    mockResolveAccountNumber(...args),
}));

import { POST } from './route';

function makeRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new Request('http://localhost/api/paystack/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/paystack/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123' },
      error: null,
      supabase: { from: vi.fn() },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not authenticated' });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
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
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Invalid CSRF token' });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('skips CSRF for bearer-authenticated requests', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: true,
      data: {
        account_name: 'Jane Doe',
        account_number: '0987654321',
      },
    });

    const response = await POST(
      makeRequest(
        { account_number: '0987654321', bank_code: '058' },
        { Authorization: 'Bearer test-token-123' }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      account_name: 'Jane Doe',
      account_number: '0987654321',
      bank_id: null,
    });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant context is missing', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
  });

  it('returns 403 when the caller lacks integrations permission', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const request = new Request('http://localhost/api/paystack/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    }) as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid JSON in request body',
    });
  });

  it('returns 400 when the request payload is invalid', async () => {
    const response = await POST(
      makeRequest({ account_number: '123', bank_code: '044' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid input');
  });

  it('accepts camelCase payloads and returns snake_case data', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: true,
      data: {
        account_name: 'Jane Doe',
        account_number: '0987654321',
        bank_id: 11,
      },
    });

    const response = await POST(
      makeRequest({ accountNumber: '0987654321', bankCode: '058' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      account_name: 'Jane Doe',
      account_number: '0987654321',
      bank_id: 11,
    });
    expect(mockResolveAccountNumber).toHaveBeenCalledWith('0987654321', '058');
  });

  it('maps provider validation errors to 400', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: false,
      error: 'Account number must be 10 digits',
      code: 'VALIDATION_ERROR',
    });

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Account number must be 10 digits',
    });
  });

  it('maps configuration failures to 500', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: false,
      error: 'PAYSTACK_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    });

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Service configuration error',
    });
  });

  it('maps upstream failures to 502', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: false,
      error: 'Gateway timeout',
      code: 'HTTP_502',
    });

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Gateway timeout' });
  });

  it('accepts alphanumeric bank_code (035A) and calls resolveAccountNumber', async () => {
    mockResolveAccountNumber.mockResolvedValueOnce({
      success: true,
      data: {
        account_name: 'Jane Doe',
        account_number: '1234567890',
      },
    });

    const response = await POST(
      makeRequest(
        { account_number: '1234567890', bank_code: '035A' },
        { Authorization: 'Bearer test-token-123' }
      )
    );

    expect(response.status).toBe(200);
    expect(mockResolveAccountNumber).toHaveBeenCalledWith('1234567890', '035A');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockAuthenticateApiRequest.mockRejectedValueOnce(
      new Error('DB connection failed')
    );

    const response = await POST(
      makeRequest({ account_number: '1234567890', bank_code: '044' })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to resolve account',
    });
  });
});
