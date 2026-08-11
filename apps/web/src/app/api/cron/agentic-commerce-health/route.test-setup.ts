import { NextRequest } from 'next/server';
import { vi } from 'vitest';
export function createCronRequest({
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

export function createSupabaseMock({
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
      if (table === 'domains') return domainQuery;
      if (table === 'merchants') return merchantQuery;
      if (table === 'crawler_logs') return crawlerQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    __mocks: {
      crawlerQuery,
      merchantQuery,
    },
  };
}

export const healthyAction = {
  code: 'AGENTIC_ACTIONS_HEALTHY',
  count: 0,
  message: 'No recent agentic action issues need attention.',
  next_step: 'No action required right now.',
  severity: 'ok' as const,
};

export const monitorAction = {
  code: 'AGENTIC_PAYMENT_PENDING',
  count: 1,
  message: 'Agentic checkouts are waiting for payment confirmation.',
  next_step: 'Confirm payment provider webhook status.',
  severity: 'monitor' as const,
};

export const attentionAction = {
  code: 'AGENTIC_PAYMENT_SETUP_FAILED',
  count: 1,
  message: 'Agentic checkouts failed while setting up payment collection.',
  next_step: 'Fix payment setup.',
  severity: 'attention' as const,
};
