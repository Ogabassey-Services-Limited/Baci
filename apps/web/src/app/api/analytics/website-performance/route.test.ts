import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();
const mockRequestGemmaCompletion = vi.fn();
const mockGetAiChatModel = vi.fn();
const mockGetAiChatProvider = vi.fn();
const mockGetLlmChatModel = vi.fn();
const mockGetLlmServerBearer = vi.fn();
const mockGetLlmServerUrl = vi.fn();
const mockGetOllamaBaseUrl = vi.fn();
const mockGetOllamaBasicAuth = vi.fn();

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

vi.mock('@/env', () => ({
  getAiChatModel: () => mockGetAiChatModel(),
  getAiChatProvider: () => mockGetAiChatProvider(),
  getLlmChatModel: () => mockGetLlmChatModel(),
  getLlmServerBearer: () => mockGetLlmServerBearer(),
  getLlmServerUrl: () => mockGetLlmServerUrl(),
  getOllamaBaseUrl: () => mockGetOllamaBaseUrl(),
  getOllamaBasicAuth: () => mockGetOllamaBasicAuth(),
}));

import { GET, maxDuration } from './route';

function createRequest(url: string, headers?: HeadersInit) {
  return new NextRequest(url, { headers });
}

function mockSuccessfulAnalyticsAggregation() {
  mockAuthenticateApiRequest.mockResolvedValueOnce({
    error: null,
    supabase: {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: {}, error: null }),
    },
    user: { id: 'user-1' },
  });
}

describe('GET /api/analytics/website-performance', () => {
  it('allows the route to outlive the Gemma fallback timeout', () => {
    expect(maxDuration).toBe(30);
  });

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
    mockGetAiChatModel.mockReturnValue('gemma4:e4b');
    mockGetAiChatProvider.mockReturnValue('auto');
    mockGetLlmChatModel.mockReturnValue('gemma4:e4b');
    mockGetLlmServerBearer.mockReturnValue('valid-llm-bearer');
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com');
    mockGetOllamaBaseUrl.mockReturnValue('http://127.0.0.1:11434');
    mockGetOllamaBasicAuth.mockReturnValue('user:pass');
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
        rpc: vi
          .fn()
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'events failed' },
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
    expect(body.error).toBe('Failed to aggregate events');
  });

  it('paginates event rows while the aggregation rpc is not deployed', async () => {
    const fullPage = Array.from({ length: 1000 }, () => ({
      event_type: 'search',
      event_data: { search_term: 'iphone' },
    }));
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({
        data: [{ event_type: 'search', event_data: { search_term: 'iphone' } }],
        error: null,
      });
    const eventQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: {
        from: vi.fn(() => eventQuery),
        rpc: vi
          .fn()
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST202', message: 'function missing' },
          }),
      },
      user: { id: 'user-1' },
    });
    mockRequestGemmaCompletion.mockResolvedValueOnce({
      status: 'success',
      data: { insights: [] },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.mostSearched).toEqual({
      query: 'iphone',
      count: 1001,
    });
    expect(range).toHaveBeenCalledWith(0, 999);
    expect(range).toHaveBeenCalledWith(1000, 1999);
    expect(eventQuery.in).toHaveBeenCalledWith('event_type', [
      'search',
      'product_view',
      'purchase',
      'add_to_cart',
    ]);
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
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: {
        rpc: vi
          .fn()
          .mockResolvedValueOnce({
            data: [
              {
                id: 'prod-1',
                name: 'Product A',
                total_sold: 50,
                total_revenue: 1000,
              },
            ],
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              mostSearched: { query: 'shoes', count: 2 },
              topConverting: {
                id: 'prod-1',
                name: 'Product A',
                actions: 10,
                conversionRate: 100,
                views: 10,
              },
            },
            error: null,
          }),
      },
      user: { id: 'user-1' },
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
    expect(mockRequestGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemma4:e4b',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        ollamaBasicAuth: 'user:pass',
        provider: 'ollama',
      })
    );
  });

  it('uses the OpenAI-compatible Gemma relay only when explicitly configured', async () => {
    mockGetAiChatProvider.mockReturnValueOnce('llm');
    mockSuccessfulAnalyticsAggregation();
    mockRequestGemmaCompletion.mockResolvedValueOnce({
      status: 'success',
      data: { insights: ['Relay insight'] },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiInsights).toEqual({ insights: ['Relay insight'] });
    expect(mockRequestGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        llmServerBearer: 'valid-llm-bearer',
        llmServerUrl: 'https://llm.example.com',
        model: 'gemma4:e4b',
        provider: 'llm',
      })
    );
  });

  it('returns deterministic fallback insights when an unsupported explicit provider is configured', async () => {
    mockGetAiChatProvider.mockReturnValueOnce('gemini');
    mockSuccessfulAnalyticsAggregation();

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
    expect(mockRequestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('uses the OpenAI-compatible relay when auto is configured and Ollama is unavailable', async () => {
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);
    mockSuccessfulAnalyticsAggregation();
    mockRequestGemmaCompletion.mockResolvedValueOnce({
      status: 'success',
      data: { insights: ['LLM fallback insight'] },
    });

    const response = await GET(
      createRequest(
        'http://localhost/api/analytics/website-performance?startDate=2026-04-01T00:00:00.000Z&endDate=2026-04-10T23:59:59.999Z'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiInsights).toEqual({
      insights: ['LLM fallback insight'],
    });
    expect(mockRequestGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        llmServerBearer: 'valid-llm-bearer',
        llmServerUrl: 'https://llm.example.com',
        provider: 'llm',
      })
    );
  });

  it('returns deterministic fallback insights when no Gemma provider configuration is available', async () => {
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);
    mockGetLlmServerUrl.mockReturnValueOnce(undefined);
    mockGetLlmServerBearer.mockReturnValueOnce(undefined);
    mockSuccessfulAnalyticsAggregation();

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
    expect(mockRequestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('returns deterministic fallback insights when the explicit Ollama provider is incomplete', async () => {
    mockGetAiChatProvider.mockReturnValueOnce('ollama');
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);
    mockSuccessfulAnalyticsAggregation();

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
    expect(mockRequestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('returns deterministic fallback insights when the explicit LLM relay configuration is incomplete', async () => {
    mockGetAiChatProvider.mockReturnValueOnce('llm');
    mockGetLlmServerBearer.mockReturnValueOnce(undefined);
    mockSuccessfulAnalyticsAggregation();

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
    expect(mockRequestGemmaCompletion).not.toHaveBeenCalled();
  });

  it('returns fallback insights when Gemma fails', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: {
        rpc: vi
          .fn()
          .mockResolvedValueOnce({ data: [], error: null })
          .mockResolvedValueOnce({ data: {}, error: null }),
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
