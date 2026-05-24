import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: vi.fn(() => 'cron-secret'),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-manifest-health', () => ({
  checkAgentCommerceManifestHealth: vi.fn(),
}));

vi.mock('@/lib/agentic/agent-commerce-feed-health', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agentic/agent-commerce-feed-health')
  >('@/lib/agentic/agent-commerce-feed-health');

  return {
    ...actual,
    checkAgentCommerceFeedHealth: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { getCronSecret } from '@/env';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { checkAgentCommerceFeedHealth } from '@/lib/agentic/agent-commerce-feed-health';
import { checkAgentCommerceManifestHealth } from '@/lib/agentic/agent-commerce-manifest-health';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { GET, maxDuration } from './route';

function createCronRequest({
  auth = 'Bearer cron-secret',
  search = '',
}: {
  auth?: string | null;
  search?: string;
} = {}) {
  return new NextRequest(
    `http://localhost:3000/api/cron/agentic-commerce-health${search}`,
    {
      headers: auth ? { authorization: auth } : {},
      method: 'GET',
    }
  );
}

function createSupabaseMock({
  crawlerError = null,
  crawlerRows = [
    {
      agent_family: 'openai',
      bot_name: 'OpenAI',
      cache_outcome: 'hit',
      crawled_at: '2026-05-22T10:00:00.000Z',
      host: 'ogabassey.com',
      response_time_ms: 120,
      status_code: 200,
      url_path: '/agent-commerce.json',
      user_agent: 'GPTBot/1.0',
    },
  ],
  merchantRows = [
    {
      business_name: 'Ogabassey',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    },
  ],
  merchantsError = null,
}: {
  crawlerError?: unknown;
  crawlerRows?: unknown[];
  merchantRows?: Array<{
    business_name: string;
    id: string;
    is_published: boolean;
    slug: string;
  }>;
  merchantsError?: unknown;
} = {}) {
  const domainQuery = {
    eq: vi.fn(),
    in: vi.fn(),
    select: vi.fn(),
  };
  domainQuery.select.mockReturnValue(domainQuery);
  domainQuery.in.mockReturnValue(domainQuery);
  domainQuery.eq.mockImplementationOnce(() => domainQuery);
  domainQuery.eq.mockResolvedValueOnce({
    data: [{ domain: 'ogabassey.com', merchant_id: 'merchant-1' }],
    error: null,
  });

  const merchantQuery = {
    in: vi.fn().mockResolvedValue({
      data: merchantRows,
      error: merchantsError,
    }),
    select: vi.fn(),
  };
  merchantQuery.select.mockReturnValue(merchantQuery);

  const crawlerQuery = {
    eq: vi.fn(),
    gte: vi.fn(),
    limit: vi.fn().mockResolvedValue({
      data: crawlerRows,
      error: crawlerError,
    }),
    order: vi.fn(),
    select: vi.fn(),
  };
  crawlerQuery.select.mockReturnValue(crawlerQuery);
  crawlerQuery.eq.mockReturnValue(crawlerQuery);
  crawlerQuery.gte.mockReturnValue(crawlerQuery);
  crawlerQuery.order.mockReturnValue(crawlerQuery);

  return {
    from: vi.fn((table: string) => {
      if (table === 'domains') {
        return domainQuery;
      }
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'crawler_logs') {
        return crawlerQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    __mocks: {
      crawlerQuery,
      merchantQuery,
    },
  };
}

const healthyAction = {
  code: 'AGENTIC_ACTIONS_HEALTHY',
  count: 0,
  message: 'No recent agentic action issues need attention.',
  next_step: 'No action required right now.',
  severity: 'ok' as const,
};

const monitorAction = {
  code: 'AGENTIC_PAYMENT_PENDING',
  count: 1,
  message: 'Agentic checkouts are waiting for payment confirmation.',
  next_step: 'Confirm payment provider webhook status.',
  severity: 'monitor' as const,
};

const attentionAction = {
  code: 'AGENTIC_PAYMENT_SETUP_FAILED',
  count: 1,
  message: 'Agentic checkouts failed while setting up payment collection.',
  next_step: 'Fix payment setup.',
  severity: 'attention' as const,
};

describe('GET /api/cron/agentic-commerce-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCronSecret).mockReturnValue('cron-secret');
    vi.mocked(checkAgentCommerceManifestHealth).mockResolvedValue({
      issue_count: 0,
      issues: [],
      status: 'ok',
      url: 'https://ogabassey.com/agent-commerce.json',
    });
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
      google_product_count: 2,
      issue_count: 0,
      issues: [],
      latest_product_updated_at: '2026-05-22T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 2,
      stale_product_count: 0,
      status: 'ok',
    });
    vi.mocked(loadAgenticActionHealth).mockResolvedValue({
      actions: [healthyAction],
      generated_at: '2026-05-22T03:00:00.000Z',
      requests: {
        recent_count: 1,
        records: [
          {
            agent_id: 'openai:chatgpt',
            api_version: '2026-04-28',
            created_at: '2026-05-22T08:03:00.000Z',
            expires_at: '2026-05-22T08:18:00.000Z',
            route: 'checkout_sessions.complete',
          },
        ],
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(createSupabaseMock() as never);
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await GET(createCronRequest({ auth: 'Bearer wrong' }));

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the cron secret is not configured', async () => {
    vi.mocked(getCronSecret).mockReturnValue(undefined);

    const response = await GET(createCronRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'server_misconfigured',
      error: 'Server misconfigured',
    });
  });

  it('returns a healthy monitor summary for the requested merchant slugs', async () => {
    const supabase = createSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);

    const response = await GET(
      createCronRequest({
        search: '?merchant_slug=Ogabassey&fail_on_attention=false',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      merchant_count: 1,
      merchants: [
        {
          actions: [],
          action_health: {
            actions: {
              ok_count: 1,
              total_count: 1,
            },
            requests: {
              recent_count: 1,
            },
          },
          business_name: 'Ogabassey',
          crawler: {
            issue_count: 0,
            status: 'ok',
          },
          feeds: {
            google_product_count: 2,
            openai_product_count: 2,
            status: 'ok',
          },
          merchant_id: 'merchant-1',
          slug: 'ogabassey',
          status: 'ok',
          status_reason: 'agentic_action_health_ok',
        },
      ],
      status: 'ok',
    });
    expect(body.merchants[0].action_health.requests).not.toHaveProperty(
      'records'
    );
    expect(supabase.__mocks.merchantQuery.select).toHaveBeenCalledWith(
      'id, slug, business_name, is_published'
    );
    expect(supabase.__mocks.merchantQuery.in).toHaveBeenCalledWith('slug', [
      'ogabassey',
    ]);
    expect(checkAgentCommerceManifestHealth).toHaveBeenCalledWith({
      custom_domain: 'ogabassey.com',
      slug: 'ogabassey',
    });
    expect(loadAgenticActionHealth).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      { recordsSource: 'admin_direct' }
    );
    expect(checkAgentCommerceFeedHealth).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      slug: 'ogabassey',
    });
    expect(supabase.__mocks.crawlerQuery.select).toHaveBeenCalledWith(
      'agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent'
    );
    expect(supabase.__mocks.crawlerQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });

  it('fails the cron response when attention actions are present by default', async () => {
    vi.mocked(loadAgenticActionHealth).mockResolvedValue({
      actions: [attentionAction],
      generated_at: '2026-05-22T03:00:00.000Z',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_PAYMENT_SETUP_FAILED',
              count: 1,
              severity: 'attention',
            },
          ],
          status: 'attention',
        },
      ],
      status: 'attention',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agentic commerce health monitor needs attention',
      })
    );
  });

  it('keeps monitor-only actions as a successful cron response', async () => {
    vi.mocked(loadAgenticActionHealth).mockResolvedValue({
      actions: [monitorAction],
      generated_at: '2026-05-22T03:00:00.000Z',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_PAYMENT_PENDING',
              count: 1,
              severity: 'monitor',
            },
          ],
          status: 'monitor',
        },
      ],
      status: 'monitor',
    });
  });

  it('keeps missing AI-agent crawler visibility as a monitor-only action', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createSupabaseMock({
        crawlerRows: [
          {
            agent_family: 'search',
            bot_name: 'Bing',
            cache_outcome: 'hit',
            crawled_at: '2026-05-22T10:00:00.000Z',
            host: 'ogabassey.com',
            response_time_ms: 120,
            status_code: 200,
            url_path: '/agent-commerce.json',
            user_agent: 'bingbot/1.0',
          },
        ],
      }) as never
    );

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_CRAWLER_VISIBILITY_MISSING',
              count: 1,
              severity: 'monitor',
            },
          ],
          crawler: {
            issue_count: 1,
            status: 'monitor',
          },
          status: 'monitor',
          status_reason: 'agent_commerce_crawler_visibility_missing',
        },
      ],
      status: 'monitor',
    });
  });

  it('fails the cron response when crawler visits are failing', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createSupabaseMock({
        crawlerRows: [
          {
            agent_family: 'openai',
            bot_name: 'OpenAI',
            cache_outcome: 'miss',
            crawled_at: '2026-05-22T10:00:00.000Z',
            host: 'ogabassey.com',
            response_time_ms: 120,
            status_code: 500,
            url_path: '/agent-commerce.json',
            user_agent: 'GPTBot/1.0',
          },
        ],
      }) as never
    );

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_CRAWLER_FETCH_FAILURES',
              count: 1,
              severity: 'attention',
            },
          ],
          crawler: {
            issue_count: 1,
            status: 'attention',
          },
          status: 'attention',
          status_reason: 'agent_commerce_crawler_fetch_failures',
        },
      ],
      status: 'attention',
    });
  });

  it('fails the cron response when crawler visibility logs cannot be loaded', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createSupabaseMock({
        crawlerError: new Error('query failed'),
      }) as never
    );

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_CRAWLER_VISIBILITY_UNAVAILABLE',
              count: 1,
              severity: 'attention',
            },
          ],
          crawler: {
            issue_count: 1,
            status: 'attention',
          },
          status: 'attention',
          status_reason: 'agent_commerce_crawler_log_unavailable',
        },
      ],
      status: 'attention',
    });
  });

  it('fails the cron response when feed generation needs attention', async () => {
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
      google_product_count: null,
      issue_count: 1,
      issues: [
        {
          code: 'feed_generation_failed',
          count: 1,
          message:
            'Agent catalog feeds could not be generated for health monitoring.',
          severity: 'attention',
        },
      ],
      latest_product_updated_at: null,
      openai_product_count: null,
      shared_product_count: null,
      stale_product_count: null,
      status: 'attention',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_FEED_GENERATION_FAILED',
              count: 1,
              severity: 'attention',
            },
          ],
          feeds: {
            issue_count: 1,
            status: 'attention',
          },
          status: 'attention',
          status_reason: 'agent_commerce_feed_generation_failed',
        },
      ],
      status: 'attention',
    });
  });

  it('keeps stale feed products as monitor-only actions', async () => {
    vi.mocked(checkAgentCommerceFeedHealth).mockResolvedValue({
      google_product_count: 2,
      issue_count: 1,
      issues: [
        {
          code: 'feed_stale',
          count: 1,
          message:
            'One or more agent-visible products have stale or missing feed timestamps.',
          severity: 'monitor',
        },
      ],
      latest_product_updated_at: '2026-04-01T10:00:00.000Z',
      openai_product_count: 2,
      shared_product_count: 2,
      stale_product_count: 1,
      status: 'monitor',
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      merchants: [
        {
          actions: [
            {
              code: 'AGENTIC_FEED_STALE_PRODUCTS',
              count: 1,
              severity: 'monitor',
            },
          ],
          feeds: {
            stale_product_count: 1,
            status: 'monitor',
          },
          status: 'monitor',
        },
      ],
      status: 'monitor',
    });
  });

  it('returns 400 for invalid query input', async () => {
    const response = await GET(
      createCronRequest({ search: '?merchant_slug=../bad' })
    );

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 500 when merchant lookup fails', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      createSupabaseMock({
        merchantsError: { message: 'database unavailable' },
      }) as never
    );

    const response = await GET(createCronRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'internal_error',
      error: 'Internal server error',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agentic commerce health monitor failed',
      })
    );
  });

  it('allows enough time to collect agentic action health', () => {
    expect(maxDuration).toBe(300);
  });
});
