import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock api-auth
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

// Mock cache revalidation
const mockRevalidateMerchant = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchant: (...args: unknown[]) => mockRevalidateMerchant(...args),
}));

// Mock Supabase
const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

let mockMerchantData: { data: unknown; error: unknown };
let mockPublishedProductCount: number;
let mockTotalProductCount: number;
let mockUpdateResult: { data: unknown; error: unknown };
let mockVerificationData: { data: unknown; error: unknown };

function createMockSupabase() {
  let productQueryCount = 0;

  return {
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(mockMerchantData),
            }),
          }),
          update: (data: unknown) => ({
            eq: () => Promise.resolve(mockUpdateResult),
            _updateData: data, // Store for assertions
          }),
        };
      }

      if (table === 'products') {
        productQueryCount++;
        const count =
          productQueryCount === 1
            ? mockPublishedProductCount
            : mockTotalProductCount;
        const result = {
          count,
          error: null,
        };
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve(result),
              ...result,
            }),
            ...result,
          }),
        };
      }

      return {
        select: () => ({ eq: () => ({ single: () => ({}) }) }),
      };
    },
  };
}

function createMockAdminSupabase() {
  return {
    from: (table: string) => {
      if (table === 'merchant_verifications') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(mockVerificationData),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

// ---- Import handlers AFTER mocks ----
import { DELETE, POST } from './route';

// ---- Helpers ----

function makeRequest(method: 'POST' | 'DELETE') {
  return new NextRequest('http://localhost:3000/api/merchant/publish', {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupAuth(hasAccess = true, hasPermissionValue = true) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: hasAccess ? { id: 'user-123' } : null,
    supabase: hasAccess ? createMockSupabase() : null,
    error: hasAccess ? null : 'Unauthorized',
  });

  mockGetUserAccess.mockResolvedValue(
    hasAccess
      ? {
          merchantId: MERCHANT_ID,
          role: 'owner',
        }
      : null
  );

  mockHasPermission.mockReturnValue(hasPermissionValue);
}

function setupMerchantData(data: Record<string, unknown> | null) {
  mockMerchantData = {
    data: data
      ? {
          id: MERCHANT_ID,
          business_name: 'Test Store',
          country: 'NG',
          support_email: 'test@example.com',
          support_phone: '+2341234567890',
          bank_code: '044',
          bank_account_number: '1234567890',
          paystack_subaccount_code: 'ACCT_test',
          ...data,
        }
      : null,
    error: data ? null : { message: 'Not found' },
  };
}

function setupProductCount(publishedCount: number, totalCount: number) {
  mockPublishedProductCount = publishedCount;
  mockTotalProductCount = totalCount;
}

function setupUpdateSuccess() {
  mockUpdateResult = {
    data: null,
    error: null,
  };
}

function setupUpdateError(errorMessage: string) {
  mockUpdateResult = {
    data: null,
    error: { message: errorMessage },
  };
}

function setupVerification(
  flags: Partial<{
    nin_verified: boolean;
    bvn_verified: boolean;
    cac_verified: boolean;
  }> | null = { nin_verified: true }
) {
  mockVerificationData = {
    data: flags
      ? {
          nin_verified: flags.nin_verified ?? false,
          bvn_verified: flags.bvn_verified ?? false,
          cac_verified: flags.cac_verified ?? false,
        }
      : null,
    error: null,
  };
}

// ---- Tests ----

describe('POST /api/merchant/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchantData = { data: null, error: null };
    mockPublishedProductCount = 0;
    mockTotalProductCount = 0;
    mockUpdateResult = { data: null, error: null };
    // Default: merchant has a verified NIN so KYC does not block the tests
    // that aren't specifically exercising the verification gate.
    setupVerification({ nin_verified: true });
    // Restore default mock implementations
    mockCreateClient.mockImplementation(() => createMockSupabase());
    mockCreateAdminClient.mockImplementation(() => createMockAdminSupabase());
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant not found', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({
        user: { id: 'user-123' },
        supabase: createMockSupabase(),
        error: null,
      });
      mockGetUserAccess.mockResolvedValue(null);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks settings edit permission', async () => {
      setupAuth(true, false);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        expect.anything(),
        'settings',
        'edit'
      );
    });
  });

  describe('validation - bank details', () => {
    it('returns 400 when bank account details are missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        bank_code: null,
        bank_account_number: null,
        paystack_subaccount_code: null,
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Cannot publish store');
      expect(json.missingItems).toContain('Bank account details');
    });

    it('returns 400 when only bank code is missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        bank_code: null,
        bank_account_number: '1234567890',
        paystack_subaccount_code: 'ACCT_test',
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain('Bank account details');
    });

    it('returns 400 when only paystack subaccount is missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        paystack_subaccount_code: null,
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain('Bank account details');
    });
  });

  describe('validation - country', () => {
    it('returns 400 when country is missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        country: null,
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain('Country/region setting');
    });
  });

  describe('validation - contact info', () => {
    it('returns 400 when both email and phone are missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        support_email: null,
        support_phone: null,
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain(
        'Contact information (email or phone)'
      );
    });

    it('succeeds when only email is provided', async () => {
      setupAuth(true, true);
      setupMerchantData({
        support_email: 'test@example.com',
        support_phone: null,
      });
      setupProductCount(1, 1);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(200);
    });

    it('succeeds when only phone is provided', async () => {
      setupAuth(true, true);
      setupMerchantData({
        support_email: null,
        support_phone: '+2341234567890',
      });
      setupProductCount(1, 1);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(200);
    });
  });

  describe('validation - kyc', () => {
    it('returns 400 when no KYC identifier is verified', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupVerification({
        nin_verified: false,
        bvn_verified: false,
        cac_verified: false,
      });
      setupProductCount(1, 1);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain(
        'Identity verification (NIN, BVN, or CAC)'
      );
    });

    it('returns 400 when no merchant_verifications row exists', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupVerification(null);
      setupProductCount(1, 1);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain(
        'Identity verification (NIN, BVN, or CAC)'
      );
    });

    it('succeeds when only BVN is verified', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupVerification({ bvn_verified: true });
      setupProductCount(1, 1);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(200);
    });

    it('succeeds when only CAC is verified', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupVerification({ cac_verified: true });
      setupProductCount(1, 1);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(200);
    });
  });

  describe('validation - products', () => {
    it('returns 400 when no active products exist', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(0, 0);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toContain('At least one active product');
    });

    it('returns 400 with helpful message when products exist but none active', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(0, 5);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.missingItems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'At least one active product (you have 5 product(s) but none are active'
          ),
        ])
      );
    });
  });

  describe('validation - multiple missing items', () => {
    it('returns all missing items in the error response', async () => {
      setupAuth(true, true);
      setupVerification({
        nin_verified: false,
        bvn_verified: false,
        cac_verified: false,
      });
      setupMerchantData({
        country: null,
        support_email: null,
        support_phone: null,
        bank_code: null,
        bank_account_number: null,
        paystack_subaccount_code: null,
      });
      setupProductCount(0, 0);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Cannot publish store');
      expect(json.message).toBe(
        'Please complete the following required items:'
      );
      expect(json.missingItems).toHaveLength(5);
      expect(json.missingItems).toContain(
        'Identity verification (NIN, BVN, or CAC)'
      );
      expect(json.missingItems).toContain('Bank account details');
      expect(json.missingItems).toContain('Country/region setting');
      expect(json.missingItems).toContain(
        'Contact information (email or phone)'
      );
      expect(json.missingItems).toContain('At least one active product');
    });
  });

  describe('success path', () => {
    it('publishes store and returns success when all requirements met', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(3, 3);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Store published successfully');
      expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    });

    it('succeeds when products are available', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(2, 5);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 404 when merchant query fails', async () => {
      setupAuth(true, true);
      setupMerchantData(null);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });

    it('returns 500 when update fails', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      setupUpdateError('Database error');

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to publish store');
    });

    it('returns 500 on unexpected exception', async () => {
      setupAuth(true, true);
      // Mock createClient to throw error
      mockCreateClient.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('DELETE /api/merchant/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchantData = { data: null, error: null };
    mockUpdateResult = { data: null, error: null };
    // Restore default mock implementation
    mockCreateClient.mockImplementation(() => createMockSupabase());
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false);

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant not found', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({
        user: { id: 'user-123' },
        supabase: createMockSupabase(),
        error: null,
      });
      mockGetUserAccess.mockResolvedValue(null);

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks settings edit permission', async () => {
      setupAuth(true, false);

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        expect.anything(),
        'settings',
        'edit'
      );
    });
  });

  describe('success path', () => {
    it('unpublishes store and returns success', async () => {
      setupAuth(true, true);
      setupMerchantData({
        id: MERCHANT_ID,
      });
      setupUpdateSuccess();

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Store unpublished successfully');
      expect(mockRevalidateMerchant).toHaveBeenCalledWith(MERCHANT_ID);
    });
  });

  describe('error handling', () => {
    it('returns 404 when merchant not found during query', async () => {
      setupAuth(true, true);
      setupMerchantData(null);

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });

    it('returns 500 when update fails', async () => {
      setupAuth(true, true);
      setupMerchantData({
        id: MERCHANT_ID,
      });
      setupUpdateError('Database error');

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to unpublish store');
    });

    it('returns 500 on unexpected exception', async () => {
      setupAuth(true, true);
      // Mock createClient to throw error
      mockCreateClient.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
