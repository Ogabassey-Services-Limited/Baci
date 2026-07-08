import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminRpc: vi.fn(),
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => mocks.adminRpc(...args),
  }),
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
    mocks.adminRpc.mockResolvedValue({ error: null });
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
      error: 'Custom domains require Baci Starter or higher',
    });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it('returns 500 "Failed to create payment" when the transaction RPC errors', async () => {
    // Regression: create_domain_purchase_transaction was missing in
    // production, so every purchase died here with this exact response
    // (Play "Broken Functionality" rejection R4).
    mocks.adminRpc.mockResolvedValue({
      error: { message: 'function does not exist' },
    });
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabase(),
      user: { email: 'owner@example.com', id: 'user-1' },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to create payment',
    });
  });

  it('creates the pending transaction via the service-role RPC and returns the Paystack URL', async () => {
    const supabase = createSupabase();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase,
      user: { email: 'owner@example.com', id: 'user-1' },
    });
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_x');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { authorization_url: 'https://checkout.paystack.com/x' },
        }),
      })
    );

    try {
      const response = await POST(createRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.authorization_url).toBe('https://checkout.paystack.com/x');
      expect(body.reference).toMatch(/^DOM-[A-Z0-9]{12}$/);

      // Pricing is server-computed and written ONLY via the admin client's
      // service-role RPC (never the user-scoped client), pinned to the
      // route-resolved merchant and acting user.
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(mocks.adminRpc).toHaveBeenCalledWith(
        'create_domain_purchase_transaction',
        expect.objectContaining({
          p_domain: 'shop.com',
          p_tld: '.com',
          p_years: 1,
          p_gateway: 'paystack',
          p_currency: 'NGN',
          p_merchant_id: 'merchant-1',
          p_user_id: 'user-1',
        })
      );
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});
