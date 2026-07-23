import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
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

const mockGetStorefrontPublicationCacheIdentity = vi.fn();
const mockEvictStorefrontPublicationCaches = vi.fn();

vi.mock('@/lib/get-storefront-publication-cache-identity', () => ({
  getStorefrontPublicationCacheIdentity: (...args: unknown[]) =>
    mockGetStorefrontPublicationCacheIdentity(...args),
}));
vi.mock('@/lib/storefront-publication-cache-eviction', () => ({
  evictStorefrontPublicationCaches: (...args: unknown[]) =>
    mockEvictStorefrontPublicationCaches(...args),
}));

// Mock Supabase
const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

let mockMerchantData: { data: unknown; error: unknown };
let mockPublishedProductCount: number;
let mockTotalProductCount: number;
let mockUpdateResult: { data: unknown; error: unknown };
let mockVerificationData: { data: unknown; error: unknown };
let mockFeatureSettingsData: { data: unknown; error: unknown };
const mockMerchantUpdate = vi.fn();

function createMockSupabase() {
  let productQueryCount = 0;

  return {
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(mockMerchantData),
            }),
          }),
          update: (data: unknown) => {
            mockMerchantUpdate(data);
            return { eq: () => Promise.resolve(mockUpdateResult) };
          },
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

      if (table === 'merchant_feature_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(mockFeatureSettingsData),
            }),
          }),
        };
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: () => ({}) }) }),
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

      // The POST merchant read names paystack_subaccount_code (revoked from the
      // authenticated role), so it is served by the service-role admin client.
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(mockMerchantData),
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

const mockCreateAdminClient = vi.fn();

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
          email: 'owner@example.com',
          phone: null,
          support_email: 'test@example.com',
          support_phone: '+2341234567890',
          bank_code: '044',
          bank_account_number: '1234567890',
          paystack_subaccount_code: 'ACCT_test',
          slug: 'test-store',
          ...data,
        }
      : null,
    error: null,
  };
}

function setupMerchantQueryError(errorMessage: string) {
  mockMerchantData = {
    data: null,
    error: { message: errorMessage },
  };
}

function setupPublicationIdentity({
  canonicalMerchantSlug = 'test-store',
  customDomains = [],
  merchantSlugs = ['test-store'],
}: {
  canonicalMerchantSlug?: string | null;
  customDomains?: string[];
  merchantSlugs?: string[];
} = {}) {
  const identity = {
    canonicalMerchantSlug,
    customDomains,
    identifiers: [...merchantSlugs, ...customDomains],
    merchantId: MERCHANT_ID,
    merchantSlugs,
  };
  mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(identity);
  return identity;
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

function setupFeatureSettings(
  data: Record<string, unknown> | null = {},
  error: { message: string } | null = null
) {
  mockFeatureSettingsData = {
    data:
      data === null || error
        ? null
        : {
            pay_on_delivery_enabled: false,
            paystack_enabled: true,
            korapay_enabled: true,
            ...data,
          },
    error,
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
    setupPublicationIdentity();
    mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: true });
    setupFeatureSettings();
    // Default: merchant has a verified NIN so KYC does not block the tests
    // that aren't specifically exercising the verification gate.
    setupVerification({ nin_verified: true });
    // Restore default admin mock implementation
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

  describe('secret column containment', () => {
    it('reads the merchant row (paystack_subaccount_code) through the service-role admin client even when the authenticated client is denied SELECT on merchants', async () => {
      setupAuth(true, true);
      // mockMerchantData holds a valid, publishable row; the admin mock serves it.
      setupMerchantData({});
      setupProductCount(1, 1);
      setupUpdateSuccess();

      // Authenticated client: SELECT on merchants fails like Postgres 42501
      // (secret column revoked from the authenticated role). UPDATE and the
      // non-secret product/feature-setting reads keep working.
      const permissionDenied = {
        data: null,
        error: {
          message: 'permission denied for table merchants',
          code: '42501',
        },
      };
      const authClient = createMockSupabase();
      const originalFrom = authClient.from;
      vi.spyOn(authClient, 'from').mockImplementation((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve(permissionDenied),
              }),
            }),
            update: (data: unknown) => {
              mockMerchantUpdate(data);
              return { eq: () => Promise.resolve(mockUpdateResult) };
            },
          };
        }
        return originalFrom(table);
      });
      mockAuthenticateApiRequest.mockResolvedValue({
        user: { id: 'user-123' },
        supabase: authClient,
        error: null,
      });

      const adminClient = createMockAdminSupabase();
      const adminFromSpy = vi.spyOn(adminClient, 'from');
      mockCreateAdminClient.mockImplementation(() => adminClient);

      const res = await POST(makeRequest('POST'));

      // Regression: reading merchants via the authenticated client would 500
      // here; the secret read must resolve through the admin client instead.
      expect(res.status).toBe(200);
      expect(adminFromSpy).toHaveBeenCalledWith('merchants');
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

    it('publishes an India merchant when Pay on Delivery is enabled and Paystack bank details are missing', async () => {
      setupAuth(true, true);
      setupMerchantData({
        country: 'IN',
        bank_code: null,
        bank_account_number: null,
        paystack_subaccount_code: null,
      });
      setupFeatureSettings({
        pay_on_delivery_enabled: true,
        paystack_enabled: false,
      });
      setupVerification({
        nin_verified: false,
        bvn_verified: false,
        cac_verified: false,
      });
      setupProductCount(1, 1);
      setupUpdateSuccess();
      const identity = setupPublicationIdentity();

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
        expect.anything(),
        MERCHANT_ID,
        'test-store'
      );
      expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
        identity
      );
    });

    it('returns 500 when payment settings cannot be loaded', async () => {
      setupAuth(true, true);
      setupMerchantData({
        country: 'IN',
        bank_code: null,
        bank_account_number: null,
        paystack_subaccount_code: null,
      });
      setupFeatureSettings(null, { message: 'database unavailable' });
      setupProductCount(1, 1);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load payment settings');
      expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
      expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
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
        email: null,
        phone: null,
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

    it('succeeds when only account email is provided', async () => {
      setupAuth(true, true);
      setupMerchantData({
        email: 'owner@example.com',
        phone: null,
        support_email: null,
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

    it('returns 500 when verification lookup fails', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      // Simulate merchant_verifications admin read failing (e.g., DB
      // outage or service-role misconfiguration). Must surface as a
      // backend error rather than collapse to a false KYC gap.
      mockVerificationData = {
        data: null,
        error: { message: 'connection refused' },
      };

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
      expect(json.missingItems).toBeUndefined();
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
        email: null,
        phone: null,
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
      const identity = setupPublicationIdentity();

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Store published successfully');
      expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
        identity
      );
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

    it('evicts every retired slug and active custom domain identity', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      setupUpdateSuccess();
      const identity = setupPublicationIdentity({
        customDomains: ['shop.example.com', 'secondary.example.com'],
        merchantSlugs: ['test-store', 'old-store'],
      });

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(200);
      expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
        identity
      );
    });
  });

  describe('error handling', () => {
    it('rejects a legacy merchant without a slug before publishing', async () => {
      setupAuth(true, true);
      setupMerchantData({ slug: null });
      setupProductCount(1, 1);
      setupUpdateSuccess();

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Cannot publish store');
      expect(json.missingItems).toContain('Store URL');
      expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
      expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
    });

    it('does not claim publish success when edge eviction fails', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      setupUpdateSuccess();
      mockEvictStorefrontPublicationCaches.mockResolvedValueOnce({
        ok: false,
        reason: 'provider_rejected',
        stage: 'cloudflare',
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).not.toBe(true);
      expect(json.code).toBe('STOREFRONT_CACHE_EVICTION_FAILED');
    });

    it('does not claim publish success when Vercel eviction fails', async () => {
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      setupUpdateSuccess();
      mockEvictStorefrontPublicationCaches.mockResolvedValueOnce({
        ok: false,
        reason: 'request_failed',
        stage: 'vercel',
      });

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).not.toBe(true);
      expect(json.code).toBe('STOREFRONT_CACHE_EVICTION_FAILED');
    });

    it('returns 404 when the merchant does not exist', async () => {
      setupAuth(true, true);
      setupMerchantData(null);

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });

    it('returns 500 for a merchant query error instead of treating it as missing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupAuth(true, true);
      setupMerchantQueryError('column does not exist');

      const res = await POST(makeRequest('POST'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load merchant');
      expect(mockMerchantUpdate).not.toHaveBeenCalled();
    });

    it('does not mutate publication state when identity lookup fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupAuth(true, true);
      setupMerchantData({});
      setupProductCount(1, 1);
      mockGetStorefrontPublicationCacheIdentity.mockRejectedValueOnce({
        message: 'domain lookup failed',
      });

      const res = await POST(makeRequest('POST'));

      expect(res.status).toBe(500);
      expect(mockMerchantUpdate).not.toHaveBeenCalled();
      expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
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
      // Force getUserAccess to throw an unexpected error inside the try block
      mockGetUserAccess.mockImplementation(() => {
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
    setupPublicationIdentity();
    mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: true });
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
      const identity = setupPublicationIdentity();

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('Store unpublished successfully');
      expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
        identity
      );
    });

    it('does not claim unpublish success when edge eviction fails', async () => {
      setupAuth(true, true);
      setupMerchantData({ id: MERCHANT_ID });
      setupUpdateSuccess();
      mockEvictStorefrontPublicationCaches.mockResolvedValueOnce({
        ok: false,
        reason: 'request_failed',
        stage: 'cloudflare',
      });

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).not.toBe(true);
      expect(json.code).toBe('STOREFRONT_CACHE_EVICTION_FAILED');
    });

    it('does not claim unpublish success when Vercel eviction fails', async () => {
      setupAuth(true, true);
      setupMerchantData({ id: MERCHANT_ID });
      setupUpdateSuccess();
      mockEvictStorefrontPublicationCaches.mockResolvedValueOnce({
        ok: false,
        reason: 'request_failed',
        stage: 'vercel',
      });

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.success).not.toBe(true);
      expect(json.code).toBe('STOREFRONT_CACHE_EVICTION_FAILED');
    });

    it('unpublishes a legacy null-slug merchant and evicts its custom domain', async () => {
      setupAuth(true, true);
      setupMerchantData({
        id: MERCHANT_ID,
        slug: null,
      });
      setupUpdateSuccess();
      const identity = setupPublicationIdentity({
        canonicalMerchantSlug: null,
        customDomains: ['ogabassey.com', 'secondary.example.com'],
        merchantSlugs: ['retired-store'],
      });

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
        expect.anything(),
        MERCHANT_ID,
        null
      );
      expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
        identity
      );
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

    it('returns 500 when the merchant query itself fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupAuth(true, true);
      setupMerchantQueryError('database unavailable');

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load merchant');
      expect(mockMerchantUpdate).not.toHaveBeenCalled();
    });

    it('does not unpublish when retired-slug identity lookup fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupAuth(true, true);
      setupMerchantData({ id: MERCHANT_ID });
      mockGetStorefrontPublicationCacheIdentity.mockRejectedValueOnce({
        message: 'alias lookup failed',
      });

      const res = await DELETE(makeRequest('DELETE'));

      expect(res.status).toBe(500);
      expect(mockMerchantUpdate).not.toHaveBeenCalled();
      expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
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
      // Force getUserAccess to throw an unexpected error inside the try block
      mockGetUserAccess.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await DELETE(makeRequest('DELETE'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
