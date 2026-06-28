import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mocks.getUserAccess(...args),
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

function createMerchantQuery(planTier = 'pro') {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            business_name: 'Baci Shop',
            email: 'merchant@example.com',
            id: 'merchant-1',
            plan_expires_at: null,
            plan_tier: planTier,
            premium_features: [],
            slug: 'baci-shop',
          },
          error: null,
        }),
      })),
    })),
  };
}

function createSupabase(planTier = 'pro') {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'merchants') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return createMerchantQuery(planTier);
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
}

function createRequest() {
  return new NextRequest('http://localhost/api/domains/initialize-payment', {
    method: 'POST',
    body: JSON.stringify({
      domain: 'shop.com',
      years: 1,
    }),
  });
}

const { POST } = await import('./route');

describe('POST /api/domains/initialize-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getUserAccess.mockResolvedValue({
      isOwner: true,
      isStaff: false,
      merchantId: 'merchant-1',
      permissions: {},
      role: 'owner',
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('returns 402 before creating a purchase transaction when custom domains are not enabled', async () => {
    const supabase = createSupabase('free');
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { email: 'owner@example.com', id: 'user-1' },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      code: 'requires_upgrade',
      error: 'Custom domains require Baci Pro',
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
