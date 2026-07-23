import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockGetCachedPlatformAnalytics = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedPlatformAnalytics: (...args: unknown[]) =>
    mockGetCachedPlatformAnalytics(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

function createQueryBuilder(result: {
  count?: number | null;
  data?: unknown;
  error?: unknown;
}) {
  const builder = {
    count: result.count ?? null,
    data: result.data ?? null,
    error: result.error ?? null,
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createMockSupabase(
  tableResponses: Record<
    string,
    Array<{ count?: number | null; data?: unknown; error?: unknown }>
  > = {},
  rpcResult:
    | { data?: unknown; error?: unknown }
    | Record<string, { data?: unknown; error?: unknown }> = {}
) {
  const queues = Object.fromEntries(
    Object.entries(tableResponses).map(([table, responses]) => [
      table,
      [...responses],
    ])
  );

  // Support per-RPC-name responses: if rpcResult has named keys like
  // { get_admin_platform_daily_summary: {...}, get_admin_top_merchants: {...} }
  const isNamedRpc =
    rpcResult &&
    !('data' in rpcResult) &&
    !('error' in rpcResult) &&
    Object.keys(rpcResult).length > 0;

  const rpc = isNamedRpc
    ? vi.fn((name: string) => {
        const result =
          (rpcResult as Record<string, { data?: unknown; error?: unknown }>)[
            name
          ] ?? {};
        return Promise.resolve({
          data: result.data ?? [],
          error: result.error ?? null,
        });
      })
    : vi.fn().mockResolvedValue({
        data: (rpcResult as { data?: unknown; error?: unknown }).data ?? [],
        error: (rpcResult as { data?: unknown; error?: unknown }).error ?? null,
      });

  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) =>
      createQueryBuilder(queues[table]?.shift() ?? {})
    ),
    rpc,
  };

  // Service-role admin client. It shares the same table queues as the
  // authenticated client but is a distinct object with its own `from` spy so
  // tests can assert that secret `merchants` reads (is_platform_admin,
  // paystack_subaccount_code, bank fields) route through the admin client per
  // the S1 column-containment fix, not through the authenticated client.
  const adminClient = {
    from: vi.fn((table: string) =>
      createQueryBuilder(queues[table]?.shift() ?? {})
    ),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return Object.assign(authClient, { __adminClient: adminClient });
}

function createRequest(url: string, init: RequestInit = {}): NextRequest {
  return new Request(url, init) as NextRequest;
}

const analyticsUrl = 'http://localhost/api/admin/analytics';

let mockSupabase = createMockSupabase();

import { GET } from './route';

describe('/api/admin/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase(
      {
        merchants: [
          { data: { is_platform_admin: true }, error: null },
          { data: [], error: null },
        ],
        orders: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        products: [{ data: [], error: null }],
      },
      {
        get_admin_merchant_health: { data: [], error: null },
        get_admin_platform_daily_summary: { data: [], error: null },
        get_admin_platform_growth: { data: [], error: null },
        get_admin_top_merchants: { data: [], error: null },
      }
    );
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
    // Resolve lazily so tests that reassign `mockSupabase` still get the
    // matching admin client without re-wiring this mock.
    mockCreateAdminClient.mockImplementation(() => mockSupabase.__adminClient);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isStaff: false },
    });
    mockGetCachedPlatformAnalytics
      .mockResolvedValueOnce({
        activeMerchants: 3,
        netToMerchants: 900,
        platformRevenue: 100,
        processorFees: 25,
        totalGmv: 1000,
        totalOrders: 5,
      })
      .mockResolvedValueOnce({
        activeMerchants: 2,
        netToMerchants: 450,
        platformRevenue: 50,
        processorFees: 10,
        totalGmv: 500,
        totalOrders: 2,
      });
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await GET(createRequest(analyticsUrl));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('reads paystack_subaccount_code via the admin client while the is_platform_admin gate stays on the authenticated client', async () => {
    const response = await GET(createRequest(`${analyticsUrl}?period=30d`));

    expect(response.status).toBe(200);
    // The merchantProfiles projection names paystack_subaccount_code, which is
    // revoked from the authenticated Postgres role (S1 containment), so an
    // authenticated-client select naming it fails the whole query with 42501.
    // It must be read via the service-role admin client.
    expect(mockSupabase.__adminClient.from).toHaveBeenCalledWith('merchants');
    // is_platform_admin stays granted to the authenticated role, so its admin
    // gate read runs on the authenticated client (like the other admin routes).
    expect(mockSupabase.from).toHaveBeenCalledWith('merchants');
    // Auth/authorization stays on the authenticated client.
    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
  });

  it('returns 400 for an invalid period before route queries run', async () => {
    const response = await GET(createRequest(`${analyticsUrl}?period=14d`));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_PERIOD');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 500 when any analytics query fails', async () => {
    mockSupabase = createMockSupabase(
      {
        merchants: [
          { data: { is_platform_admin: true }, error: null },
          { data: [], error: null },
        ],
        orders: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        products: [{ data: [], error: null }],
      },
      {
        get_admin_merchant_health: { data: [], error: null },
        get_admin_platform_daily_summary: {
          data: null,
          error: { message: 'summary unavailable' },
        },
        get_admin_platform_growth: { data: [], error: null },
        get_admin_top_merchants: { data: [], error: null },
      }
    );
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(createRequest(`${analyticsUrl}?period=30d`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch analytics data');
    expect(mockGetCachedPlatformAnalytics).not.toHaveBeenCalled();
  });

  it('returns shaped analytics data for a valid request', async () => {
    mockSupabase = createMockSupabase(
      {
        merchants: [
          { data: { is_platform_admin: true }, error: null },
          {
            data: [
              {
                bank_account_name: 'Baci Store',
                bank_account_number: '0123456789',
                bank_code: '058',
                business_name: 'Baci Store',
                business_type: 'fashion',
                id: 'merchant-1',
                is_published: true,
                kyc_status: 'verified',
                paystack_subaccount_code: 'ACCT_test',
                signup_source: 'web',
                slug: 'baci-store',
                support_email: 'support@baci.app',
                support_phone: null,
              },
              {
                bank_account_name: null,
                bank_account_number: null,
                bank_code: null,
                business_name: null,
                business_type: null,
                id: 'merchant-2',
                is_published: false,
                kyc_status: 'pending',
                paystack_subaccount_code: null,
                signup_source: 'ios',
                slug: null,
                support_email: null,
                support_phone: null,
              },
              {
                bank_account_name: null,
                bank_account_number: null,
                bank_code: null,
                business_name: 'Mobile Shop',
                business_type: 'Church',
                id: 'merchant-3',
                is_published: false,
                kyc_status: 'pending',
                paystack_subaccount_code: null,
                signup_source: 'android',
                slug: 'mobile-shop',
                support_email: null,
                support_phone: '08000000000',
              },
            ],
            error: null,
          },
        ],
        orders: [
          {
            data: [
              { merchant_id: 'merchant-1', payment_status: 'paid' },
              { merchant_id: 'merchant-3', payment_status: 'paid' },
            ],
            error: null,
          },
          {
            data: [
              {
                merchant_id: 'merchant-1',
                payment_method: 'card',
                payment_status: 'paid',
                shipping_status: 'processing',
                source: 'online_store',
                total: 700,
              },
              {
                merchant_id: 'merchant-3',
                payment_method: 'bank_transfer',
                payment_status: 'paid',
                shipping_status: 'delivered',
                source: 'mobile_app',
                total: 300,
              },
            ],
            error: null,
          },
        ],
        products: [
          {
            data: [
              { merchant_id: 'merchant-1' },
              { merchant_id: 'merchant-3' },
            ],
            error: null,
          },
        ],
      },
      {
        get_admin_merchant_health: {
          data: [
            { health_status: 'healthy' },
            { health_status: 'at_risk' },
            { health_status: 'new' },
          ],
          error: null,
        },
        get_admin_platform_daily_summary: {
          data: [
            {
              active_merchants: 2,
              platform_gmv: 700,
              sale_date: '2026-03-01',
              total_orders: 4,
            },
          ],
          error: null,
        },
        get_admin_platform_growth: {
          data: [
            { month: '2026-03-01', new_merchants: 4 },
            { month: '2026-02-01', new_merchants: 2 },
          ],
          error: null,
        },
        get_admin_top_merchants: {
          data: [
            {
              business_name: 'Baci Store',
              merchant_id: 'merchant-1',
              total_gmv: 700,
              total_orders: 4,
            },
          ],
          error: null,
        },
      }
    );
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(createRequest(`${analyticsUrl}?period=7d`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalMerchants).toBe(3);
    expect(body.summary.totalGmv).toBe(1000);
    expect(body.summary.grossGmv).toBe(1000);
    expect(body.summary.grossOrders).toBe(2);
    expect(body.summary.orderChange).toBe(150);
    expect(body.summary.avgOrderValue).toBe(200);
    expect(body.summary.aovChange).toBe(-20);
    expect(body.growth.newMerchantsThisMonth).toBe(4);
    expect(body.salesByChannel).toHaveLength(2);
    expect(body.salesByChannel[0]).toMatchObject({
      channel: 'online_store',
      gmv: 700,
      orders: 1,
    });
    expect(body.salesByChannel[0].shareOfGmv).toBeCloseTo(70, 5);
    expect(body.salesByChannel[0].shareOfOrders).toBeCloseTo(50, 5);
    expect(body.salesByChannel[1]).toMatchObject({
      channel: 'mobile_app',
      gmv: 300,
      orders: 1,
    });
    expect(body.salesByChannel[1].shareOfGmv).toBeCloseTo(30, 5);
    expect(body.salesByChannel[1].shareOfOrders).toBeCloseTo(50, 5);
    expect(body.merchantActivation).toHaveLength(9);
    expect(body.merchantActivation[0]).toMatchObject({
      description: 'All merchant records',
      key: 'signed_up',
      label: 'Signed Up',
      merchants: 3,
    });
    expect(body.merchantActivation[0].completionRate).toBeCloseTo(100, 5);
    expect(body.merchantActivation[1]).toMatchObject({
      description: 'Merchants categorized during onboarding',
      key: 'business_type_set',
      label: 'Business Type Set',
      merchants: 1,
    });
    expect(body.merchantActivation[1].completionRate).toBeCloseTo(33.333333, 5);
    expect(body.merchantActivation[2]).toMatchObject({
      description: 'Merchants with business name and storefront slug',
      key: 'store_configured',
      label: 'Store Configured',
      merchants: 2,
    });
    expect(body.merchantActivation[2].completionRate).toBeCloseTo(
      66.66666666666666,
      5
    );
    expect(body.merchantActivation[3]).toMatchObject({
      description: 'Merchants with customer-facing support contact details',
      key: 'support_ready',
      label: 'Support Ready',
      merchants: 2,
    });
    expect(body.merchantActivation[3].completionRate).toBeCloseTo(
      66.66666666666666,
      5
    );
    expect(body.merchantActivation[4]).toMatchObject({
      description: 'Merchants with at least one product in catalog',
      key: 'products_added',
      label: 'Products Added',
      merchants: 2,
    });
    expect(body.merchantActivation[4].completionRate).toBeCloseTo(
      66.66666666666666,
      5
    );
    expect(body.merchantActivation[5]).toMatchObject({
      description: 'Merchants with payout details configured',
      key: 'payout_ready',
      label: 'Payout Ready',
      merchants: 1,
    });
    expect(body.merchantActivation[5].completionRate).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.merchantActivation[6]).toMatchObject({
      description: 'Stores currently live for shoppers',
      key: 'published',
      label: 'Published',
      merchants: 1,
    });
    expect(body.merchantActivation[6].completionRate).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.merchantActivation[7]).toMatchObject({
      description: 'Merchants cleared for compliance review',
      key: 'kyc_verified',
      label: 'KYC Verified',
      merchants: 1,
    });
    expect(body.merchantActivation[7].completionRate).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.merchantActivation[8]).toMatchObject({
      description: 'Merchants with at least one paid order',
      key: 'first_paid_order',
      label: 'First Paid Order',
      merchants: 2,
    });
    expect(body.merchantActivation[8].completionRate).toBeCloseTo(
      66.66666666666666,
      5
    );
    expect(body.businessTypes).toHaveLength(3);
    expect(body.businessTypes[0]).toMatchObject({
      businessType: 'fashion',
      classification: 'configured',
      label: 'Fashion & Apparel',
      merchants: 1,
      rawValues: [],
    });
    expect(body.businessTypes[0].shareOfMerchants).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.businessTypes[1]).toMatchObject({
      businessType: 'invalid',
      classification: 'invalid',
      label: 'Invalid / Legacy Values',
      merchants: 1,
      rawValues: ['Church'],
    });
    expect(body.businessTypes[1].shareOfMerchants).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.businessTypes[2]).toMatchObject({
      businessType: 'unspecified',
      classification: 'unspecified',
      label: 'Unspecified',
      merchants: 1,
      rawValues: [],
    });
    expect(body.businessTypes[2].shareOfMerchants).toBeCloseTo(
      33.33333333333333,
      5
    );
    expect(body.paymentStatuses).toEqual([
      {
        amount: 1000,
        label: 'Paid',
        orders: 2,
        shareOfAmount: 100,
        shareOfOrders: 100,
        status: 'paid',
      },
    ]);
    expect(body.shippingStatuses).toEqual([
      {
        amount: 700,
        label: 'Processing',
        orders: 1,
        shareOfAmount: 70,
        shareOfOrders: 50,
        status: 'processing',
      },
      {
        amount: 300,
        label: 'Delivered',
        orders: 1,
        shareOfAmount: 30,
        shareOfOrders: 50,
        status: 'delivered',
      },
    ]);
    expect(body.paymentMethods).toEqual([
      {
        amount: 700,
        label: 'Card',
        method: 'card',
        orders: 1,
        shareOfPaidAmount: 70,
        shareOfPaidOrders: 50,
      },
      {
        amount: 300,
        label: 'Bank Transfer',
        method: 'bank_transfer',
        orders: 1,
        shareOfPaidAmount: 30,
        shareOfPaidOrders: 50,
      },
    ]);
    expect(body.topMerchants).toEqual([
      {
        gmv: 700,
        id: 'merchant-1',
        name: 'Baci Store',
        orders: 4,
      },
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_admin_merchant_health');
    expect(body.dailyGmv).toEqual([
      {
        date: '2026-03-01',
        gmv: 700,
        merchants: 2,
        orders: 4,
      },
    ]);
  });

  it('includes incomplete signups in total merchant counts and health totals', async () => {
    const healthRows = [
      {
        business_name: null,
        email: 'pending-1@example.com',
        health_status: 'new',
        merchant_id: 'merchant-pending-1',
      },
      {
        business_name: null,
        email: 'pending-2@example.com',
        health_status: 'new',
        merchant_id: 'merchant-pending-2',
      },
      {
        business_name: 'Active Store',
        email: 'active@example.com',
        health_status: 'healthy',
        merchant_id: 'merchant-active',
      },
      ...Array.from({ length: 194 }, (_, index) => ({
        business_name: null,
        email: `merchant-${index + 3}@example.com`,
        health_status: 'new',
        merchant_id: `merchant-${index + 3}`,
      })),
    ];
    mockSupabase = createMockSupabase(
      {
        merchants: [
          { data: { is_platform_admin: true }, error: null },
          {
            data: healthRows.map((row, index) => ({
              bank_account_name: null,
              bank_account_number: null,
              bank_code: null,
              business_name: row.business_name,
              business_type: index === 2 ? 'fashion' : null,
              id: row.merchant_id,
              is_published: false,
              kyc_status: 'pending',
              paystack_subaccount_code: null,
              signup_source: 'web',
              slug: row.business_name ? 'active-store' : null,
              support_email: null,
              support_phone: null,
            })),
            error: null,
          },
        ],
        orders: [
          {
            data: [{ merchant_id: 'merchant-active', payment_status: 'paid' }],
            error: null,
          },
          {
            data: [
              {
                merchant_id: 'merchant-active',
                payment_status: 'paid',
                source: 'online_store',
                total: 100,
              },
            ],
            error: null,
          },
        ],
        products: [
          {
            data: [{ merchant_id: 'merchant-active' }],
            error: null,
          },
        ],
      },
      {
        get_admin_merchant_health: { data: healthRows, error: null },
        get_admin_platform_daily_summary: { data: [], error: null },
        get_admin_platform_growth: {
          data: [{ month: '2026-03-01', new_merchants: 12 }],
          error: null,
        },
        get_admin_top_merchants: { data: [], error: null },
      }
    );
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(createRequest(`${analyticsUrl}?period=30d`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalMerchants).toBe(197);
    expect(body.merchantHealth).toEqual({
      healthy: 1,
      atRisk: 0,
      churned: 0,
      new: 196,
    });
    expect(body.merchantActivation).toHaveLength(9);
    expect(body.merchantActivation[0]).toMatchObject({
      description: 'All merchant records',
      key: 'signed_up',
      label: 'Signed Up',
      merchants: 197,
    });
    expect(body.merchantActivation[0].completionRate).toBeCloseTo(100, 5);
    expect(body.merchantActivation[1]).toMatchObject({
      description: 'Merchants categorized during onboarding',
      key: 'business_type_set',
      label: 'Business Type Set',
      merchants: 1,
    });
    expect(body.merchantActivation[1].completionRate).toBeCloseTo(
      0.5076142131979695,
      5
    );
    expect(body.merchantActivation[2]).toMatchObject({
      description: 'Merchants with business name and storefront slug',
      key: 'store_configured',
      label: 'Store Configured',
      merchants: 1,
    });
    expect(body.merchantActivation[2].completionRate).toBeCloseTo(
      0.5076142131979695,
      5
    );
    expect(body.merchantActivation[3]).toMatchObject({
      description: 'Merchants with customer-facing support contact details',
      key: 'support_ready',
      label: 'Support Ready',
      merchants: 0,
    });
    expect(body.merchantActivation[3].completionRate).toBeCloseTo(0, 5);
    expect(body.merchantActivation[4]).toMatchObject({
      description: 'Merchants with at least one product in catalog',
      key: 'products_added',
      label: 'Products Added',
      merchants: 1,
    });
    expect(body.merchantActivation[4].completionRate).toBeCloseTo(
      0.5076142131979695,
      5
    );
    expect(body.merchantActivation[5]).toMatchObject({
      description: 'Merchants with payout details configured',
      key: 'payout_ready',
      label: 'Payout Ready',
      merchants: 0,
    });
    expect(body.merchantActivation[5].completionRate).toBeCloseTo(0, 5);
    expect(body.merchantActivation[6]).toMatchObject({
      description: 'Stores currently live for shoppers',
      key: 'published',
      label: 'Published',
      merchants: 0,
    });
    expect(body.merchantActivation[6].completionRate).toBeCloseTo(0, 5);
    expect(body.merchantActivation[7]).toMatchObject({
      description: 'Merchants cleared for compliance review',
      key: 'kyc_verified',
      label: 'KYC Verified',
      merchants: 0,
    });
    expect(body.merchantActivation[7].completionRate).toBeCloseTo(0, 5);
    expect(body.merchantActivation[8]).toMatchObject({
      description: 'Merchants with at least one paid order',
      key: 'first_paid_order',
      label: 'First Paid Order',
      merchants: 1,
    });
    expect(body.merchantActivation[8].completionRate).toBeCloseTo(
      0.5076142131979695,
      5
    );
    expect(body.businessTypes[0]).toMatchObject({
      businessType: 'unspecified',
      classification: 'unspecified',
      label: 'Unspecified',
      merchants: 196,
      rawValues: [],
    });
    expect(body.businessTypes[0].shareOfMerchants).toBeCloseTo(
      99.49238578680203,
      5
    );
  });

  it('returns 500 when get_admin_platform_growth RPC fails', async () => {
    mockSupabase = createMockSupabase(
      {
        merchants: [
          { data: { is_platform_admin: true }, error: null },
          { data: [], error: null },
        ],
        orders: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        products: [{ data: [], error: null }],
      },
      {
        get_admin_merchant_health: { data: [], error: null },
        get_admin_platform_daily_summary: { data: [], error: null },
        get_admin_platform_growth: {
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for table platform_growth',
          },
        },
        get_admin_top_merchants: { data: [], error: null },
      }
    );
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(createRequest(`${analyticsUrl}?period=30d`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch analytics data');
  });
});
