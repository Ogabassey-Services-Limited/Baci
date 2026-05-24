import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockGetInternalApiSecret = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();

vi.mock('@/env', () => ({
  getInternalApiSecret: () => mockGetInternalApiSecret(),
  getRootDomain: () => 'usebaci.com',
}));

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

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

import { GET, POST } from './route';

function createRequest(
  url: string,
  init: { body?: unknown; headers?: HeadersInit; method?: string } = {}
) {
  return new NextRequest(url, {
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: init.headers,
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
  });
}

function createPostQueryMock() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return { insert };
}

function createDomainQueryMock(merchantId: string | null) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: merchantId ? { merchant_id: merchantId } : null,
      error: null,
    }),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function createMerchantQueryMock(merchantId: string | null) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: merchantId ? { id: merchantId } : null,
      error: null,
    }),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function createCrawlerLogSelectMock(rows: Record<string, unknown>[] = []) {
  const query = {
    eq: vi.fn(),
    gte: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    order: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

describe('/api/analytics/crawler-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInternalApiSecret.mockReturnValue('internal-secret');
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: vi.fn() },
      user: { id: 'user-1' },
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: { isOwner: true, permissions: {} },
    });
    mockToUserAccess.mockReturnValue({ isOwner: true, permissions: {} });
    mockHasPermission.mockReturnValue(true);
  });

  it('does not log POST events when the internal secret is not configured', async () => {
    mockGetInternalApiSecret.mockReturnValue(undefined);

    const response = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: {
          urlPath: '/agent-commerce.json',
          userAgent: 'GPTBot/1.0',
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      logged: false,
      reason: 'logging_unconfigured',
      success: true,
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('rejects POST events without the internal bearer secret', async () => {
    const response = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: {
          urlPath: '/agent-commerce.json',
          userAgent: 'GPTBot/1.0',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects POST events with wrong-length bearer secrets without logging', async () => {
    const payload = {
      urlPath: '/agent-commerce.json',
      userAgent: 'GPTBot/1.0',
    };

    const shortSecretResponse = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: payload,
        headers: { authorization: 'Bearer short' },
      })
    );
    const longSecretResponse = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: payload,
        headers: { authorization: 'Bearer internal-secret-extra' },
      })
    );

    expect(shortSecretResponse.status).toBe(401);
    expect(longSecretResponse.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('validates POST event payloads', async () => {
    const response = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: { urlPath: '/agent-commerce.json' },
        headers: { authorization: 'Bearer internal-secret' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_CRAWLER_LOG');
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('logs agent crawler events with host, merchant, status, latency, and cache outcome', async () => {
    const crawlerInsert = createPostQueryMock();
    const domainQuery = createDomainQueryMock('merchant-domain-1');
    const from = vi.fn((table: string) => {
      if (table === 'crawler_logs') return crawlerInsert;
      if (table === 'domains') return domainQuery;
      return createMerchantQueryMock(null);
    });
    mockCreateAdminClient.mockReturnValue({ from });

    const response = await POST(
      createRequest('http://localhost/api/analytics/crawler-log', {
        body: {
          cacheOutcome: 'miss',
          host: 'https://ogabassey.com/products',
          responseTimeMs: 125,
          statusCode: 200,
          urlPath: '/agent-commerce.json?source=openai',
          userAgent: 'GPTBot/1.0',
        },
        headers: { authorization: 'Bearer internal-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(crawlerInsert.insert).toHaveBeenCalledWith({
      agent_family: 'openai',
      bot_name: 'OpenAI',
      cache_outcome: 'miss',
      host: 'ogabassey.com',
      merchant_id: 'merchant-domain-1',
      response_time_ms: 125,
      status_code: 200,
      url_path: '/agent-commerce.json?source=openai',
      user_agent: 'GPTBot/1.0',
    });
    expect(domainQuery.eq).toHaveBeenCalledWith('domain', 'ogabassey.com');
  });

  it('requires authentication for crawler stats', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await GET(
      createRequest('http://localhost/api/analytics/crawler-log')
    );

    expect(response.status).toBe(401);
  });

  it('requires analytics view permission for crawler stats', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await GET(
      createRequest('http://localhost/api/analytics/crawler-log')
    );

    expect(response.status).toBe(403);
  });

  it('returns merchant-scoped crawler stats', async () => {
    const rows = [
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T01:00:00.000Z',
        host: 'ogabassey.com',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-commerce.json',
        user_agent: 'GPTBot/1.0',
      },
    ];
    const crawlerQuery = createCrawlerLogSelectMock(rows);
    const scopedSupabase = { from: vi.fn(() => crawlerQuery) };
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: null,
      supabase: scopedSupabase,
      user: { id: 'user-1' },
    });

    const response = await GET(
      createRequest('http://localhost/api/analytics/crawler-log?days=14')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCrawls).toBe(1);
    expect(body.byBot[0]).toMatchObject({
      count: 1,
      family: 'openai',
      name: 'OpenAI',
    });
    expect(body.health.aiAgentCrawls).toBe(1);
    expect(crawlerQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(crawlerQuery.limit).toHaveBeenCalledWith(1000);
  });

  it('rejects invalid stats query windows', async () => {
    const response = await GET(
      createRequest('http://localhost/api/analytics/crawler-log?days=91')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_QUERY');
  });
});
