import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();
const mockRequestGemmaCompletion = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('@/lib/gemma/gemma-completion', () => ({
  requestGemmaCompletion: (...args: unknown[]) =>
    mockRequestGemmaCompletion(...args),
}));

import { GET } from './route';

function createRequest(url: string, headers?: HeadersInit) {
  return new NextRequest(url, { headers });
}

describe('GET /api/analytics/website-performance', () => {
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
  });

  it('returns 401 when auth fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Invalid or expired token',
      supabase: null,
      user: null,
    });

    const response = await GET(
      createRequest('http://localhost/api/analytics/website-performance')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when no merchant context is found', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const response = await GET(
      createRequest('http://localhost/api/analytics/website-performance')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 403 when the user lacks analytics permission', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await GET(
      createRequest('http://localhost/api/analytics/website-performance')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when startDate is after endDate', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-10T00:00:00.000Z&endDate=2026-04-01T00:00:00.000Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_QUERY');
  });

  it('returns 400 when date range is longer than 30 days', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-01-01T00:00:00.000Z&endDate=2026-02-15T00:00:00.000Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_DATE_RANGE');
    expect(body.error).toBe('Date range cannot exceed 30 days');
  });

  it('returns 400 when a single provided boundary expands beyond the 30-day range', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-01-01T00:00:00.000Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_DATE_RANGE');
  });

  it('returns 500 when best-seller aggregation fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'rpc failed' },
        }),
      },
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to aggregate best seller');
  });

  it('returns 500 when analytics events aggregation fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'events failed' },
          }),
        }),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to aggregate events');
  });

  it('returns 400 when branchId is provided', async () => {
    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?branchId=some-branch'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_SCOPE');
    expect(body.error).toBe(
      'Branch filtering is not supported for website performance metrics'
    );
  });
  it('returns deterministic analytics data for a valid request', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockGte = vi.fn().mockReturnThis();
    const mockLte = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: {
        from: vi.fn((table) => {
          if (table === 'analytics_events') {
            return {
              select: mockSelect,
              eq: mockEq,
              gte: mockGte,
              lte: mockLte,
              in: mockIn,
            };
          }
          return { select: mockSelect, eq: mockEq };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [
            { id: 'prod-1', name: 'Product A', units_sold: 50, revenue: 1000 },
          ],
          error: null,
        }),
      },
      user: { id: 'user-1' },
    });

    mockIn.mockResolvedValue({
      data: [
        { event_type: 'search', event_data: { query: 'shoes' } },
        { event_type: 'search', event_data: { query: 'shoes' } },
        { event_type: 'search', event_data: { query: 'shirts' } },
        {
          event_type: 'product_view',
          event_data: { product_id: 'prod-1', product_name: 'Product A' },
        },
        {
          event_type: 'purchase',
          event_data: { product_id: 'prod-1', product_name: 'Product A' },
        },
      ],
      error: null,
    });

    mockRequestGemmaCompletion.mockResolvedValueOnce({
      status: 'success',
      data: {
        insights: ['Your website is performing well'],
      },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope).toEqual({ type: 'all' });

    // Best Seller
    expect(body.summary.bestSeller).toEqual({
      id: 'prod-1',
      name: 'Product A',
      units_sold: 50,
      revenue: 1000,
    });

    // Most Searched
    expect(body.summary.mostSearched).toEqual({ query: 'shoes', count: 2 });

    // Top Converting
    expect(body.summary.topConverting).toEqual({
      id: 'prod-1',
      name: 'Product A',
      conversionRate: 100,
    });

    // AI Insights
    expect(body.aiInsights).toEqual({
      insights: ['Your website is performing well'],
    });
  });

  it('returns fallback insights when Gemma fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
      user: { id: 'user-1' },
    });

    mockRequestGemmaCompletion.mockResolvedValueOnce({
      status: 'error',
      error: 'Network error',
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiInsights).toEqual({
      insights: [
        'Website performance data aggregated successfully.',
        'No significant search or conversion trends detected in this period.',
      ],
    });
  });
});
