import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantAnalyticsOverview = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-analytics-overview', () => ({
  getMerchantAnalyticsOverview: (...args: unknown[]) =>
    mockGetMerchantAnalyticsOverview(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

import { GET } from './route';

function createRequest(url: string) {
  return new NextRequest(url);
}

const BRANCH_ID = '123e4567-e89b-42d3-a456-426614174001';

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: vi.fn() },
      user: { id: 'user-1' },
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isOwner: true },
    });
    mockToUserAccess.mockReturnValue({ isOwner: true, permissions: {} });
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantAnalyticsOverview.mockResolvedValue({
      blog: {
        draftPosts: 0,
        publishedPosts: 1,
        topPost: null,
        totalPosts: 1,
        totalViews: 5,
      },
      brandBreakdown: [],
      chartData: [{ day: 'Apr 10', revenue: 1200 }],
      customerBreakdown: [],
      recentSales: [],
      salesByChannel: [],
      salesByPaymentMethod: [],
      summary: {
        activeNow: { change: 0, value: 0 },
        aov: { change: 0, value: 1200 },
        customers: { change: 0, value: 1 },
        discounts: 0,
        grossMargin: { change: 0, value: 50 },
        revenuePerCustomer: { change: 0, value: 1200 },
        profit: { change: 0, value: 600 },
        refundRate: { change: 0, value: 0 },
        revenue: { change: 0, value: 1200 },
        sales: { change: 0, value: 1 },
        shipping: 0,
        subtotal: 1200,
        tax: 0,
        taxDue: { change: 0, value: 0 },
        totalUnitsSold: 1,
      },
      topBrand: null,
      topCustomer: null,
      topPaymentMethod: null,
      topProducts: [],
    });
  });

  it('returns 401 when auth fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Invalid or expired token',
      supabase: null,
      user: null,
    });

    const response = await GET(createRequest('http://localhost/api/analytics'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Invalid or expired token');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid query', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-10T00:00:00.000Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_QUERY');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 400 when startDate is after endDate', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-10T00:00:00.000Z&endDate=2026-04-01T00:00:00.000Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_QUERY');
    expect(typeof body.error).toBe('string');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns analytics data for a valid request', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.profit.value).toBe(600);
    expect(body.summary.revenuePerCustomer).toEqual({
      change: 0,
      value: 1200,
    });
    expect(body.blog.totalViews).toBe(5);
    expect(mockGetMerchantAnalyticsOverview).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-10T23:59:59.999Z'),
      undefined
    );
  });

  it('passes a validated branch id into the analytics overview', async () => {
    const branchQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: BRANCH_ID }, error: null }),
      select: vi.fn().mockReturnThis(),
    };
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: { from: vi.fn(() => branchQuery) },
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest(
        `http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z&branchId=${BRANCH_ID}`
      )
    );

    expect(response.status).toBe(200);
    expect(branchQuery.eq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(branchQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(branchQuery.eq).toHaveBeenCalledWith('active', true);
    expect(mockGetMerchantAnalyticsOverview).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-10T23:59:59.999Z'),
      BRANCH_ID
    );
  });

  it('returns 400 for an invalid branch id', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z&branchId=branch-1'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_QUERY');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 404 when branchId does not belong to the merchant', async () => {
    const branchQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
    };
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: { from: vi.fn(() => branchQuery) },
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest(
        `http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z&branchId=${BRANCH_ID}`
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Branch not found');
    expect(body.code).toBe('BRANCH_NOT_FOUND');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns a coded error when branch validation fails', async () => {
    const branchQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB failed' } }),
      select: vi.fn().mockReturnThis(),
    };
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: { from: vi.fn(() => branchQuery) },
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest(
        `http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z&branchId=${BRANCH_ID}`
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'BRANCH_VALIDATION_FAILED',
      error: 'Failed to validate branch',
    });
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks analytics permission', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 404 when no merchant context is found', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
    expect(mockGetMerchantAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('returns 500 when analytics aggregation fails', async () => {
    mockGetMerchantAnalyticsOverview.mockRejectedValueOnce(new Error('boom'));

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
