import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockFetchCacCompanies = vi.fn();
const mockFetchCacTaxId = vi.fn();
const mockFindMatchingCacCompany = vi.fn();
const mockLoadMerchantSingle = vi.fn();
const mockLoadMerchantEq = vi.fn(() => ({ single: mockLoadMerchantSingle }));
const mockLoadMerchantSelect = vi.fn(() => ({ eq: mockLoadMerchantEq }));
const mockUpdateMerchantSingle = vi.fn();
const mockUpdateMerchantSelect = vi.fn(() => ({
  single: mockUpdateMerchantSingle,
}));
const mockUpdateMerchantEq = vi.fn(() => ({
  select: mockUpdateMerchantSelect,
}));
const mockUpdateMerchant = vi.fn(() => ({ eq: mockUpdateMerchantEq }));
const mockFrom = vi.fn(() => ({
  select: mockLoadMerchantSelect,
  update: mockUpdateMerchant,
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
  toUserAccess: (context: { merchantId: string }) => ({
    merchantId: context.merchantId,
  }),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/cac-public-records', () => ({
  fetchCacCompanies: (...args: unknown[]) => mockFetchCacCompanies(...args),
  fetchCacTaxId: (...args: unknown[]) => mockFetchCacTaxId(...args),
  findMatchingCacCompany: (...args: unknown[]) =>
    mockFindMatchingCacCompany(...args),
}));

const { POST } = await import('./route');

function createRequest(merchantId: string): NextRequest {
  return new Request('http://localhost/api/merchant/verify-tax-id', {
    method: 'POST',
    body: JSON.stringify({
      merchantId,
      taxIdentificationNumber: '2522599781276',
    }),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

describe('POST /api/merchant/verify-tax-id tenant selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: { from: mockFrom },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockCheckRateLimit.mockResolvedValue(true);
    mockHasPermission.mockReturnValue(true);
  });

  it('uses the explicitly selected authorized merchant instead of an unordered default', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-b',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
    mockLoadMerchantSingle.mockResolvedValue({
      data: {
        id: 'merchant-b',
        business_name: 'Baci B',
        legal_entity_name: 'BACI B LIMITED',
        cac_rc_number: 'RC-2',
      },
      error: null,
    });
    mockFetchCacCompanies.mockResolvedValue([{ companyId: 2 }]);
    mockFindMatchingCacCompany.mockReturnValue({ companyId: 2 });
    mockFetchCacTaxId.mockResolvedValue('2522599781276');
    mockUpdateMerchantSingle.mockResolvedValue({
      data: { id: 'merchant-b' },
      error: null,
    });

    const response = await POST(
      createRequest('22222222-2222-4222-8222-222222222222')
    );

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId: '22222222-2222-4222-8222-222222222222' }
    );
    expect(mockLoadMerchantEq).toHaveBeenCalledWith('id', 'merchant-b');
    expect(mockUpdateMerchantEq).toHaveBeenCalledWith('id', 'merchant-b');
  });

  it('returns 404 without merchant or provider side effects when the requested merchant is inaccessible', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const response = await POST(
      createRequest('33333333-3333-4333-8333-333333333333')
    );

    expect(response.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockFetchCacCompanies).not.toHaveBeenCalled();
    expect(mockFetchCacTaxId).not.toHaveBeenCalled();
    expect(mockFindMatchingCacCompany).not.toHaveBeenCalled();
    expect(mockUpdateMerchant).not.toHaveBeenCalled();
  });
});
