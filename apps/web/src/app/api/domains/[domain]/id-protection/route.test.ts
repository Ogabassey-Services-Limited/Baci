import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetDomainIDProtection = vi.fn();
const mockUpdateDomainIDProtection = vi.fn();
const mockRequireMerchantFeatureAccess = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/audit-logger', () => ({
  logAudit: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/go54', () => ({
  getDomainIDProtection: (...args: unknown[]) =>
    mockGetDomainIDProtection(...args),
  updateDomainIDProtection: (...args: unknown[]) =>
    mockUpdateDomainIDProtection(...args),
}));

vi.mock('@/lib/merchant-feature-gates', () => ({
  requireMerchantFeatureAccess: (...args: unknown[]) =>
    mockRequireMerchantFeatureAccess(...args),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const { GET, POST } = await import('./route');

function createSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'domains') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'domain-1', merchant_id: 'merchant-1' },
                error: null,
              }),
            })),
          })),
        })),
      };
    }),
  };
}

function createGetRequest() {
  return new NextRequest('http://localhost/api/domains/shop.com/id-protection');
}

function createPostRequest() {
  return new NextRequest(
    'http://localhost/api/domains/shop.com/id-protection',
    {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function createParams() {
  return { params: Promise.resolve({ domain: 'shop.com' }) };
}

describe('/api/domains/[domain]/id-protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabase(),
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mockHasPermission.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetDomainIDProtection.mockResolvedValue({ enabled: false });
    mockRequireMerchantFeatureAccess.mockResolvedValue(null);
  });

  it('returns ID protection settings for a merchant domain', async () => {
    const response = await GET(createGetRequest(), createParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false });
    expect(mockGetDomainIDProtection).toHaveBeenCalledWith('shop.com');
  });

  it('returns 402 before reading ID protection when custom domains are locked', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('domain lookup should not run');
      }),
    };
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });
    mockRequireMerchantFeatureAccess.mockResolvedValueOnce(
      Response.json(
        {
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Pro',
        },
        { status: 402 }
      )
    );

    const response = await GET(createGetRequest(), createParams());

    expect(response.status).toBe(402);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockGetDomainIDProtection).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 402 before updating ID protection when custom domains are locked', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('domain lookup should not run');
      }),
    };
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { id: 'user-1' },
    });
    mockRequireMerchantFeatureAccess.mockResolvedValueOnce(
      Response.json(
        {
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Pro',
        },
        { status: 402 }
      )
    );

    const response = await POST(createPostRequest(), createParams());

    expect(response.status).toBe(402);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockUpdateDomainIDProtection).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
