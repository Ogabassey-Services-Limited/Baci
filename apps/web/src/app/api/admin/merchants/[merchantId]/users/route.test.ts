import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();
const mockGetAdminMerchantUserDirectory = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();

vi.mock('@/lib/admin-merchant-users', () => ({
  getAdminMerchantUserDirectory: (...args: unknown[]) =>
    mockGetAdminMerchantUserDirectory(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const directoryResponse = {
  generatedAt: '2026-03-20T10:00:00.000Z',
  merchant: {
    businessName: 'Baci Store',
    createdAt: '2026-03-20T10:00:00.000Z',
    email: 'owner@example.com',
    id: '11111111-1111-4111-8111-111111111111',
    isPublished: true,
    phone: '+2348000000000',
    planTier: 'pro',
    signupSource: 'web',
    slug: 'baci-store',
    updatedAt: '2026-03-21T10:00:00.000Z',
  },
  summary: {
    activeAdminAppInstallations: 1,
    activeStorefrontAppInstallations: 1,
    customerUsers: 1,
    staffUsers: 1,
    unmatchedAppUsers: 0,
    webUsers: 3,
  },
  users: {
    customers: [],
    owner: {
      activeAppInstallations: 0,
      appPlatforms: [],
      createdAt: '2026-03-20T10:00:00.000Z',
      email: 'owner@example.com',
      id: 'owner-user',
      lastSeenAt: null,
      name: 'Baci Store',
      role: 'owner',
      status: 'active',
      surfaces: ['web'],
      userId: 'owner-user',
    },
    staff: [],
    unmatchedAppUsers: [],
  },
};

let authUser: { id: string } | null;
const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: authUser },
      error: authUser ? null : { message: 'not authenticated' },
    })),
  },
  from: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { is_platform_admin: true },
        error: null,
      })),
      select: vi.fn(),
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { is_platform_admin: true },
          error: null,
        })),
      })),
    })),
  })),
};

function createRequest(url: string): NextRequest {
  return new Request(url) as NextRequest;
}

function createContext(merchantId: string) {
  return {
    params: Promise.resolve({ merchantId }),
  };
}

import { GET } from './route';

describe('/api/admin/merchants/[merchantId]/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 'admin-user' };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'platform-admin-merchant',
      staffAccess: { isStaff: false },
    });
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: directoryResponse,
      error: null,
    });
  });

  it('returns 401 when the user is not authenticated', async () => {
    authUser = null;

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for an invalid merchant id', async () => {
    const response = await GET(
      createRequest('http://localhost/api/admin/merchants/not-a-uuid/users'),
      createContext('not-a-uuid')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_MERCHANT_ID');
  });

  it('returns 403 when the requester is staff instead of a platform admin owner', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'platform-admin-merchant',
      staffAccess: { isStaff: true },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Permission denied');
  });

  it('returns 404 when the authenticated user has no merchant context', async () => {
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('User not associated with a merchant');
  });

  it('returns 403 when the requester merchant is not a platform admin', async () => {
    mockSupabase.from.mockReturnValueOnce({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { is_platform_admin: false },
          error: null,
        })),
        select: vi.fn(),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { is_platform_admin: false },
            error: null,
          })),
        })),
      })),
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Admin access required');
  });

  it('returns 404 when the target merchant is missing', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 500 when the merchant directory fetch fails', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch merchant users');
  });

  it('returns the merchant directory when the requester is a platform admin', async () => {
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const response = await GET(
      createRequest(
        'http://localhost/api/admin/merchants/11111111-1111-4111-8111-111111111111/users'
      ),
      createContext('11111111-1111-4111-8111-111111111111')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe('2026-03-20T10:00:00.000Z');
    expect(body.merchant.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.merchant.businessName).toBe('Baci Store');
    expect(body.merchant.planTier).toBe('pro');
    expect(body.summary.webUsers).toBe(3);
    expect(body.summary.staffUsers).toBe(1);
    expect(body.summary.activeAdminAppInstallations).toBe(1);
    expect(body.users.owner).toMatchObject({
      email: 'owner@example.com',
      role: 'owner',
      status: 'active',
    });
    expect(infoSpy).toHaveBeenCalledWith(
      'Admin merchant users directory read:',
      expect.objectContaining({
        adminUserId: 'admin-user',
        merchantId: '11111111-1111-4111-8111-111111111111',
        totalUsers: 1,
      })
    );

    infoSpy.mockRestore();
  });
});
