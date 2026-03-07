import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockCookies = vi.fn();
const mockGetCachedPlatformAnalytics = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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
  > = {}
) {
  const queues = Object.fromEntries(
    Object.entries(tableResponses).map(([table, responses]) => [
      table,
      [...responses],
    ])
  );

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) =>
      createQueryBuilder(queues[table]?.shift() ?? {})
    ),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
}

function createRequest(url: string, init: RequestInit = {}): NextRequest {
  return new Request(url, init) as NextRequest;
}

let mockSupabase = createMockSupabase();

import { GET, POST } from './route';

describe('/api/admin/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase({
      merchants: [
        { data: { is_platform_admin: true }, error: null },
        { count: 12, data: null, error: null },
      ],
      merchant_health: [{ data: [], error: null }],
      platform_daily_summary: [{ data: [], error: null }],
      platform_growth: [{ data: [], error: null }],
      top_merchants: [{ data: [], error: null }],
    });
    mockCookies.mockReturnValue(new Map());
    mockCreateClient.mockReturnValue(mockSupabase);
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
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      createRequest('http://localhost/api/admin/analytics')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for an invalid period before route queries run', async () => {
    const response = await GET(
      createRequest('http://localhost/api/admin/analytics?period=14d')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_PERIOD');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 500 when any analytics query fails', async () => {
    mockSupabase = createMockSupabase({
      merchants: [
        { data: { is_platform_admin: true }, error: null },
        { count: 12, data: null, error: null },
      ],
      merchant_health: [{ data: [], error: null }],
      platform_daily_summary: [
        { data: null, error: { message: 'summary unavailable' } },
      ],
      platform_growth: [{ data: [], error: null }],
      top_merchants: [{ data: [], error: null }],
    });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(
      createRequest('http://localhost/api/admin/analytics?period=30d')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch analytics data');
    expect(mockGetCachedPlatformAnalytics).not.toHaveBeenCalled();
  });

  it('returns shaped analytics data for a valid request', async () => {
    mockSupabase = createMockSupabase({
      merchants: [
        { data: { is_platform_admin: true }, error: null },
        { count: 12, data: null, error: null },
      ],
      merchant_health: [
        {
          data: [
            { health_status: 'healthy' },
            { health_status: 'at_risk' },
            { health_status: 'new' },
          ],
          error: null,
        },
      ],
      platform_daily_summary: [
        {
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
      ],
      platform_growth: [
        {
          data: [
            { month: '2026-03-01', new_merchants: 4 },
            { month: '2026-02-01', new_merchants: 2 },
          ],
          error: null,
        },
      ],
      top_merchants: [
        {
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
      ],
    });
    mockCreateClient.mockReturnValue(mockSupabase);

    const response = await GET(
      createRequest('http://localhost/api/admin/analytics?period=7d')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalMerchants).toBe(12);
    expect(body.summary.totalGmv).toBe(1000);
    expect(body.growth.newMerchantsThisMonth).toBe(4);
    expect(body.topMerchants).toEqual([
      {
        gmv: 700,
        id: 'merchant-1',
        name: 'Baci Store',
        orders: 4,
      },
    ]);
    expect(body.dailyGmv).toEqual([
      {
        date: '2026-03-01',
        gmv: 700,
        merchants: 2,
        orders: 4,
      },
    ]);
  });

  it('returns 403 when CSRF validation fails on POST', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await POST(
      createRequest('http://localhost/api/admin/analytics/refresh', {
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('refreshes analytics views on a valid POST request', async () => {
    const response = await POST(
      createRequest('http://localhost/api/admin/analytics/refresh', {
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'refresh_platform_analytics_views'
    );
  });
});
