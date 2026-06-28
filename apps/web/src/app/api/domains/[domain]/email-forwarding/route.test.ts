import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetDomainEmailForwarding = vi.fn();
const mockUpdateDomainEmailForwarding = vi.fn();
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
  getDomainEmailForwarding: (...args: unknown[]) =>
    mockGetDomainEmailForwarding(...args),
  updateDomainEmailForwarding: (...args: unknown[]) =>
    mockUpdateDomainEmailForwarding(...args),
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
  return new NextRequest(
    'http://localhost/api/domains/shop.com/email-forwarding'
  );
}

function createPostRequest() {
  return new NextRequest(
    'http://localhost/api/domains/shop.com/email-forwarding',
    {
      method: 'POST',
      body: JSON.stringify({
        forwards: [{ forwardto: 'support@example.com', prefix: 'support' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function createParams() {
  return { params: Promise.resolve({ domain: 'shop.com' }) };
}

describe('/api/domains/[domain]/email-forwarding', () => {
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
    mockGetDomainEmailForwarding.mockResolvedValue({ forwards: [] });
    mockRequireMerchantFeatureAccess.mockResolvedValue(null);
  });

  it('returns email forwarding settings for a merchant domain', async () => {
    const response = await GET(createGetRequest(), createParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ forwards: [] });
    expect(mockGetDomainEmailForwarding).toHaveBeenCalledWith('shop.com');
  });

  it('returns 402 before reading forwarding settings when custom domains are locked', async () => {
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
    expect(mockGetDomainEmailForwarding).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 402 before updating forwarding settings when custom domains are locked', async () => {
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
    expect(mockUpdateDomainEmailForwarding).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
