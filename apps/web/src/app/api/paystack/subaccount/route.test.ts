import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockCreateSubaccount,
  mockFetchPaystackSubaccountCode,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  mockResolveAccountNumber,
  mockRevalidateTag,
  mockToUserAccess,
  mockUpdateSubaccount,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockCreateSubaccount: vi.fn(),
  mockFetchPaystackSubaccountCode: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockHasPermission: vi.fn(),
  mockResolveAccountNumber: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockToUserAccess: vi.fn(),
  mockUpdateSubaccount: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
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

vi.mock('@/lib/fetch-merchant-payment-secret', () => ({
  fetchMerchantPaystackSubaccountCode: (...args: unknown[]) =>
    mockFetchPaystackSubaccountCode(...args),
}));

import { POST } from './route';

const DEFAULT_MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

function makeRequest(
  body: string | Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const requestBody =
    typeof body === 'string'
      ? body
      : {
          merchantId: DEFAULT_MERCHANT_ID,
          ...body,
        };
  return new Request('http://localhost/api/paystack/subaccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:
      typeof requestBody === 'string'
        ? requestBody
        : JSON.stringify(requestBody),
  }) as unknown as NextRequest;
}

describe('POST /api/paystack/subaccount', () => {
  const mockMerchantSingle = vi.fn();
  const mockMerchantUpdateEq = vi.fn();
  const mockMerchantUpdate = vi.fn(() => ({ eq: mockMerchantUpdateEq }));
  const mockMerchantSelectEq = vi.fn(() => ({ single: mockMerchantSingle }));
  const mockMerchantSelect = vi.fn(() => ({ eq: mockMerchantSelectEq }));
  const mockWalletUpdateMaybeSingle = vi.fn();
  const mockWalletUpdateSelect = vi.fn(() => ({
    maybeSingle: mockWalletUpdateMaybeSingle,
  }));
  const mockWalletUpdateEq = vi.fn(() => ({ select: mockWalletUpdateSelect }));
  const mockWalletUpdate = vi.fn(() => ({ eq: mockWalletUpdateEq }));
  const mockRpc = vi.fn();
  // Non-secret merchant columns are read on the authenticated client via
  // `.select`; the revoked `paystack_subaccount_code` is read through the
  // bounded RPC helper (mocked as `mockFetchPaystackSubaccountCode`), never a
  // direct secret-column SELECT and never a service-role admin client.
  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: mockMerchantSelect,
          update: mockMerchantUpdate,
        };
      }

      if (table === 'merchant_wallets') {
        return {
          update: mockWalletUpdate,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: mockRpc,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: mockMerchantSelect,
          update: mockMerchantUpdate,
        };
      }

      if (table === 'merchant_wallets') {
        return {
          update: mockWalletUpdate,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    mockFetchPaystackSubaccountCode.mockResolvedValue(null);

    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123', email: 'owner@example.com' },
      error: null,
      supabase: mockSupabase,
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: DEFAULT_MERCHANT_ID,
      staffAccess: { role: 'owner', isOwner: true, isStaff: false },
    });
    mockToUserAccess.mockReturnValue({
      merchantId: DEFAULT_MERCHANT_ID,
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: {},
    });
    mockHasPermission.mockReturnValue(true);
    mockMerchantSingle.mockResolvedValue({
      data: {
        business_name: 'Baci Store',
        country: 'NG',
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });
    mockMerchantUpdateEq.mockResolvedValue({ error: null });
    mockWalletUpdateMaybeSingle.mockResolvedValue({
      data: { id: 'wallet-123' },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 'wallet-123', error: null });
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

  it('authorizes and writes only the merchant explicitly selected by the request', async () => {
    const merchantId = '33333333-3333-4333-8333-333333333333';
    mockGetMerchantForApiRequest.mockResolvedValueOnce({
      merchantId,
      staffAccess: { role: 'owner', isOwner: true, isStaff: false },
    });
    mockToUserAccess.mockReturnValueOnce({
      merchantId,
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: {},
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        merchantId,
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      { requestedMerchantId: merchantId }
    );
    expect(mockMerchantSelectEq).toHaveBeenCalledWith('id', merchantId);
    expect(mockMerchantUpdateEq).toHaveBeenCalledWith('id', merchantId);
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `features-${merchantId}`,
      'merchant'
    );
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

  it('rejects an unscoped payout mutation before merchant lookup', async () => {
    const response = await POST(
      new Request('http://localhost/api/paystack/subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        }),
      }) as unknown as NextRequest
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid input' });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
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
      bank_account_name: 'Jane Doe',
      bank_code: '044',
      bank_name: 'Unknown Bank',
    });
    expect(mockRpc).toHaveBeenCalledWith('get_or_create_merchant_wallet', {
      p_merchant_id: DEFAULT_MERCHANT_ID,
    });
    expect(mockWalletUpdate).toHaveBeenCalledWith({
      auto_payout_enabled: true,
    });
    // Busts the cached storefront-features Paystack lookup so checkout picks up
    // the newly configured subaccount without waiting for the cache TTL.
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `features-${DEFAULT_MERCHANT_ID}`,
      'merchant'
    );
  });

  it('reads non-secret merchant fields on the authenticated client and the revoked paystack_subaccount_code via the bounded RPC helper', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(200);
    // Auth/permission gates ran on the authenticated client first.
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      { requestedMerchantId: DEFAULT_MERCHANT_ID }
    );
    expect(mockHasPermission).toHaveBeenCalled();
    // Non-secret columns are read on the authenticated client, scoped to the
    // already-resolved merchant id.
    expect(mockMerchantSelect).toHaveBeenCalledWith(
      'business_name, country, email, phone'
    );
    expect(mockMerchantSelectEq).toHaveBeenCalledWith(
      'id',
      DEFAULT_MERCHANT_ID
    );
    // The revoked secret column is read through the SECURITY DEFINER RPC helper
    // on the same authenticated client, never a service-role admin client.
    expect(mockFetchPaystackSubaccountCode).toHaveBeenCalledWith(
      mockSupabase,
      DEFAULT_MERCHANT_ID
    );
  });

  it('does not read merchant data before authorization passes', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(403);
    expect(mockMerchantSelect).not.toHaveBeenCalled();
    expect(mockFetchPaystackSubaccountCode).not.toHaveBeenCalled();
  });

  it('returns the saved subaccount when feature cache invalidation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateTag.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Jane Doe',
      subaccountCode: 'ACCT_new123',
    });
    expect(mockMerchantUpdateEq).toHaveBeenCalled();
  });

  it('saves manual invoice bank details for India without calling Paystack', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Yodha Shopping',
        country: 'IN',
        email: 'yodhashopping@gmail.com',
        phone: null,
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'HDFC Bank',
        accountName: 'Yodha Shopping',
        businessName: 'Yodha Shopping',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Yodha Shopping',
      subaccountCode: null,
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
    expect(mockUpdateSubaccount).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).toHaveBeenCalledWith({
      paystack_subaccount_code: null,
      bank_account_number: 'IN-123456789012',
      bank_account_name: 'Yodha Shopping',
      bank_code: null,
      bank_name: 'HDFC Bank',
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockWalletUpdate).not.toHaveBeenCalled();
    // Clearing the subaccount must also bust the cached features lookup so
    // checkout stops advertising Paystack.
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `features-${DEFAULT_MERCHANT_ID}`,
      'merchant'
    );
  });

  it('returns saved manual bank details when feature cache invalidation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateTag.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Yodha Shopping',
        country: 'IN',
        email: 'yodhashopping@gmail.com',
        phone: null,
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'HDFC Bank',
        accountName: 'Yodha Shopping',
        businessName: 'Yodha Shopping',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Yodha Shopping',
      subaccountCode: null,
    });
    expect(mockMerchantUpdateEq).toHaveBeenCalled();
  });

  it('rejects placeholder manual invoice bank names for India', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Yodha Shopping',
        country: 'IN',
        email: 'yodhashopping@gmail.com',
        phone: null,
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'Unknown Bank',
        businessName: 'Yodha Shopping',
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Enter the actual bank name to save manual invoice bank details.',
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
    expect(mockUpdateSubaccount).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when bank_code is missing from request payload', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890123456',
        businessName: 'Yodha Shopping',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid input');
    expect(body.details.fieldErrors.bank_code).toContain(
      'Bank code is required'
    );
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
    expect(mockUpdateSubaccount).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('rejects auto-payout changes for India bank details', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Yodha Shopping',
        country: 'IN',
        email: 'yodhashopping@gmail.com',
        phone: null,
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890123456',
        bankName: 'HDFC Bank',
        businessName: 'Yodha Shopping',
        autoPayoutEnabled: true,
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        'Auto-payout settings are only available for Nigerian Paystack settlements',
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
    expect(mockUpdateSubaccount).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockWalletUpdate).not.toHaveBeenCalled();
  });

  it('updates an existing subaccount instead of creating a new one', async () => {
    mockMerchantSingle.mockResolvedValueOnce({
      data: {
        business_name: 'Baci Store',
        country: 'NG',
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });
    // The existing subaccount code is returned by the bounded RPC helper.
    mockFetchPaystackSubaccountCode.mockResolvedValueOnce('ACCT_existing123');

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

  it('does not update wallet settings when auto payout preferences are omitted', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockWalletUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when payout mode is explicitly provided', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        payoutMode: 'weekly',
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Payout mode is no longer supported in the bank details save flow',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
  });

  it('returns 403 when a staff member tries to update auto payout settings', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: DEFAULT_MERCHANT_ID,
      staffAccess: { role: 'admin', isOwner: false, isStaff: true },
    });
    mockToUserAccess.mockReturnValueOnce({
      merchantId: DEFAULT_MERCHANT_ID,
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { integrations: { manage: true } },
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        autoPayoutEnabled: true,
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Only merchant owners can update auto-payout settings',
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
  });

  it('returns 500 when the wallet update affects no rows', async () => {
    mockWalletUpdateMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        autoPayoutEnabled: true,
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to update auto-payout settings',
    });
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
