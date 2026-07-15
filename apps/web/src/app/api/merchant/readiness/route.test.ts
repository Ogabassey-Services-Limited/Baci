import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  isPaypalConnectionValidForLaunch: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: vi.fn((context) => context.staffAccess),
}));

vi.mock('@/lib/payments/paypal-launch-connection', () => ({
  isPaypalConnectionValidForLaunch: mocks.isPaypalConnectionValidForLaunch,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

function merchantRow() {
  return {
    id: 'merchant-1',
    bank_account_number: '0001112223',
    bank_code: '044',
    business_address: '12 Allen Avenue',
    business_name: 'Bassey Phones',
    country: 'NG',
    payout_currency: 'NGN',
    email: 'owner@example.com',
    facebook_pixel_id: null,
    google_analytics_id: null,
    hero_slides: [],
    is_published: false,
    logo_url: 'https://cdn.example/logo.png',
    pages: { about: 'About us', privacy: 'Privacy', terms: 'Terms' },
    phone: null,
    paystack_subaccount_code: 'ACCT_6uujpqtzmnufzkw',
    snapchat_pixel_id: null,
    social_media: {},
    support_email: 'support@example.com',
    support_phone: null,
    tiktok_pixel_id: null,
    twitter_pixel_id: null,
  };
}

function queryResult(data: unknown, error: unknown = null, count?: number) {
  return {
    data,
    error,
    count,
  };
}

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function countChain(result: unknown) {
  const query = Promise.resolve(result) as Promise<unknown> & {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  return query;
}

function createReadinessSupabaseMock(options?: {
  featureSettingsError?: unknown;
  featureSettings?: unknown;
  homePageConfig?: unknown;
  latestJob?: unknown;
  latestJobError?: unknown;
  merchant?: unknown;
  productCount?: number;
  user?: { id: string } | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options?.user === undefined ? { id: 'user-1' } : options.user,
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return chain(queryResult(options?.merchant ?? merchantRow()));
      }

      if (table === 'staff_members') {
        return chain(queryResult(null));
      }

      if (table === 'products') {
        return countChain({
          count: options?.productCount ?? 1,
          data: null,
          error: null,
        });
      }

      if (table === 'ai_jobs') {
        return chain(
          queryResult(
            options?.latestJob ?? null,
            options?.latestJobError ?? null
          )
        );
      }

      if (table === 'page_configs') {
        return chain(queryResult(options?.homePageConfig ?? { id: 'page-1' }));
      }

      if (table === 'merchant_feature_settings') {
        return chain(
          queryResult(
            options?.featureSettings ?? {
              korapay_enabled: true,
              pay_on_delivery_enabled: false,
              paystack_enabled: true,
            },
            options?.featureSettingsError ?? null
          )
        );
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createAdminSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'merchant_verifications') {
        throw new Error(`Unexpected admin table ${table}`);
      }
      return chain(
        queryResult({
          bvn_verified: true,
          cac_verified: false,
          nin_verified: false,
        })
      );
    }),
  };
}

describe('GET /api/merchant/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockImplementation(
      (_access: unknown, _resource: string, action: string) => action !== 'edit'
    );
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    mocks.createAdminClient.mockReturnValue(createAdminSupabaseMock());
    mocks.isPaypalConnectionValidForLaunch.mockResolvedValue(false);
  });

  it('returns 401 when no web session exists', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({ user: null })
    );

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant context is missing', async () => {
    mocks.createClient.mockReturnValue(createReadinessSupabaseMock());
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
  });

  it('returns starter readiness with store build status', async () => {
    mocks.hasPermission.mockReturnValue(true);
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        latestJob: {
          id: 'job-1',
          status: 'completed',
          error: null,
          result_applied_at: null,
          created_at: '2026-04-28T10:00:00.000Z',
        },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storeBuild).toEqual(
      expect.objectContaining({
        aiStatus: 'ready',
        canApplyAiDraft: true,
        latestJobId: 'job-1',
        starterStoreReady: true,
      })
    );
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'first_product', completed: true }),
      ])
    );
  });

  it('marks India Pay on Delivery as the completed launch payment method without Paystack bank details', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        merchant: {
          ...merchantRow(),
          country: 'IN',
          bank_account_number: null,
          bank_code: null,
          paystack_subaccount_code: null,
        },
        featureSettings: {
          korapay_enabled: false,
          pay_on_delivery_enabled: true,
          paystack_enabled: false,
        },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'payment_method',
          completed: true,
          label: 'Enable a payment method',
        }),
      ])
    );
    expect(body.isReady).toBe(true);
  });

  it('marks the launch payment requirement complete for a non-NG merchant with a validated PayPal connection', async () => {
    mocks.isPaypalConnectionValidForLaunch.mockResolvedValue(true);
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        merchant: {
          ...merchantRow(),
          country: 'GB',
          bank_account_number: null,
          bank_code: null,
          paystack_subaccount_code: null,
        },
        featureSettings: {
          korapay_enabled: false,
          pay_on_delivery_enabled: false,
          paystack_enabled: false,
        },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.isPaypalConnectionValidForLaunch).toHaveBeenCalledWith(
      'merchant-1',
      null
    );
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'payment_method',
          completed: true,
          description: 'PayPal is connected for customer checkout',
        }),
      ])
    );
    expect(body.isReady).toBe(true);
  });

  it('never checks the PayPal vault for an NG merchant', async () => {
    mocks.createClient.mockReturnValue(createReadinessSupabaseMock());

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.isPaypalConnectionValidForLaunch).not.toHaveBeenCalled();
  });

  it('mentions connecting a payment provider for a non-NG merchant with no payment method configured', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        merchant: {
          ...merchantRow(),
          country: 'GB',
          bank_account_number: null,
          bank_code: null,
          paystack_subaccount_code: null,
        },
        featureSettings: {
          korapay_enabled: false,
          pay_on_delivery_enabled: false,
          paystack_enabled: false,
        },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'payment_method',
          completed: false,
          description:
            'Enable Pay on Delivery or connect a payment provider (e.g. PayPal) to accept online payments',
        }),
      ])
    );
    expect(body.isReady).toBe(false);
  });

  it('marks contact info complete when only the onboarding account email exists', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        merchant: {
          ...merchantRow(),
          support_email: null,
          support_phone: null,
          email: 'owner@example.com',
          phone: null,
        },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'contact_info', completed: true }),
      ])
    );
  });

  it('returns 500 when storefront job status cannot be loaded', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        latestJobError: { message: 'query failed' },
      })
    );
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected route error.
    });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load storefront build status',
      code: 'STOREFRONT_JOB_LOAD_FAILED',
    });
  });

  it('returns 500 when payment settings cannot be loaded', async () => {
    mocks.createClient.mockReturnValue(
      createReadinessSupabaseMock({
        featureSettings: null,
        featureSettingsError: { message: 'query failed' },
      })
    );

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load payment settings',
      code: 'PAYMENT_SETTINGS_LOAD_FAILED',
    });
  });
});
