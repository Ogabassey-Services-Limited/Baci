import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockFetchCacCompanies = vi.fn();
const mockFindMatchingCacCompany = vi.fn();
const mockFetchCacTaxId = vi.fn();
const mockLoadMerchantSingle = vi.fn();
const mockUpdateMerchantSingle = vi.fn();
const mockLoadMerchantEq = vi.fn(() => ({ single: mockLoadMerchantSingle }));
const mockLoadMerchantSelect = vi.fn(() => ({ eq: mockLoadMerchantEq }));
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

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
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

function createPostRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/merchant/verify-tax-id', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as unknown as NextRequest;
}

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  legal_entity_name: 'OGABASSEY SERVICES LIMITED',
  cac_rc_number: 'RC7389159',
};

const cacCompany = {
  approvedName: 'OGABASSEY SERVICES LIMITED',
  rcNumber: '7389159',
  companyId: 7_955_903,
  classificationId: 2,
  status: 'ACTIVE',
};

describe('POST /api/merchant/verify-tax-id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: { from: mockFrom },
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-1',
      isOwner: true,
      isStaff: false,
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockLoadMerchantSingle.mockResolvedValue({ data: merchant, error: null });
    mockFetchCacCompanies.mockResolvedValue([cacCompany]);
    mockFindMatchingCacCompany.mockReturnValue(cacCompany);
    mockFetchCacTaxId.mockResolvedValue('2522599781276');
    mockUpdateMerchantSingle.mockResolvedValue({
      data: { id: 'merchant-1', tax_identification_number: '2522599781276' },
      error: null,
    });
  });

  it('returns 401 when authentication fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(403);
    expect(mockUpdateMerchant).not.toHaveBeenCalled();
  });

  it('returns 403 when the user cannot edit settings', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(403);
    expect(mockUpdateMerchant).not.toHaveBeenCalled();
  });

  it('rejects invalid tax id values before calling CAC', async () => {
    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '123456789' })
    );

    expect(response.status).toBe(400);
    expect(mockFetchCacCompanies).not.toHaveBeenCalled();
  });

  it('matches CAC tax_id and saves the normalized merchant tax id', async () => {
    const response = await POST(
      createPostRequest({
        taxIdentificationNumber: ' 252-259-9781276 ',
        legalEntityName: 'OGABASSEY SERVICES LIMITED',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockFetchCacCompanies).toHaveBeenCalledWith('RC7389159');
    expect(mockFindMatchingCacCompany).toHaveBeenCalledWith([cacCompany], {
      legalEntityName: 'OGABASSEY SERVICES LIMITED',
      rcNumber: 'RC7389159',
    });
    expect(mockUpdateMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_identification_number: '2522599781276',
      })
    );
    expect(payload).toMatchObject({
      verified: true,
      taxIdentificationNumber: '2522599781276',
    });
  });

  it('can verify by saved CAC number when no legal name is available', async () => {
    mockLoadMerchantSingle.mockResolvedValue({
      data: {
        ...merchant,
        business_name: null,
        legal_entity_name: null,
        cac_rc_number: 'RC7389159',
      },
      error: null,
    });

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(200);
    expect(mockFindMatchingCacCompany).toHaveBeenCalledWith([cacCompany], {
      legalEntityName: undefined,
      rcNumber: 'RC7389159',
    });
    expect(mockUpdateMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_identification_number: '2522599781276',
      })
    );
  });

  it('returns 422 and does not save when the CAC tax id does not match', async () => {
    mockFetchCacTaxId.mockResolvedValue('0000000000000');

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(422);
    expect(mockUpdateMerchant).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'tax_id_mismatch',
    });
  });

  it('returns 404 when CAC search cannot find this business', async () => {
    mockFindMatchingCacCompany.mockReturnValue(null);

    const response = await POST(
      createPostRequest({ taxIdentificationNumber: '2522599781276' })
    );

    expect(response.status).toBe(404);
    expect(mockFetchCacTaxId).not.toHaveBeenCalled();
    expect(mockUpdateMerchant).not.toHaveBeenCalled();
  });
});
