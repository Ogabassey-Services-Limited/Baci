import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentCommerceCrawlerHealthActions,
  buildAgentCommerceManifestHealthActions,
  checkAgentCommerceCrawlerHealth,
  fetchPrimaryAgenticMerchantDomains,
  getAgentCommerceCrawlerStatusReason,
  getAgentCommerceManifestStatusReason,
  getAgenticCommerceHealthStatus,
  summarizeAgenticCommerceHealthActions,
} from './agent-commerce-health-monitor';

describe('buildAgentCommerceManifestHealthActions', () => {
  it('returns no action when manifest health is ok', () => {
    expect(
      buildAgentCommerceManifestHealthActions({
        issue_count: 0,
        issues: [],
        status: 'ok',
        url: 'https://ogabassey.com/agent-commerce.json',
      })
    ).toEqual([]);
  });

  it('maps manifest drift into an attention action', () => {
    expect(
      buildAgentCommerceManifestHealthActions({
        issue_count: 2,
        issues: [{ code: 'manifest_contract_drift', message: 'drift' }],
        status: 'attention',
        url: 'https://ogabassey.com/agent-commerce.json',
      })
    ).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
        count: 2,
        severity: 'attention',
      }),
    ]);
  });

  it('uses an unavailable status reason when the manifest cannot be fetched', () => {
    const manifest = {
      issue_count: 1,
      issues: [{ code: 'manifest_unavailable' as const, message: 'missing' }],
      status: 'attention' as const,
      url: 'https://ogabassey.com/agent-commerce.json',
    };

    expect(buildAgentCommerceManifestHealthActions(manifest)[0].code).toBe(
      'AGENT_COMMERCE_MANIFEST_UNAVAILABLE'
    );
    expect(
      getAgentCommerceManifestStatusReason(manifest, 'agentic_action_health_ok')
    ).toBe('agent_commerce_manifest_unavailable');
  });
});

describe('agent-commerce crawler health', () => {
  it('maps crawler visibility issues into health actions and status reasons', () => {
    const crawler = {
      issue_count: 2,
      issues: [
        {
          code: 'crawler_fetch_failures' as const,
          count: 2,
          message: 'failed',
          severity: 'attention' as const,
        },
        {
          code: 'crawler_visibility_missing' as const,
          count: 1,
          message: 'missing',
          severity: 'monitor' as const,
        },
      ],
      status: 'attention' as const,
      summary: null,
      window_days: 14,
    };

    expect(buildAgentCommerceCrawlerHealthActions(crawler)).toEqual([
      expect.objectContaining({
        code: 'AGENTIC_CRAWLER_FETCH_FAILURES',
        count: 2,
        severity: 'attention',
      }),
      expect.objectContaining({
        code: 'AGENTIC_CRAWLER_VISIBILITY_MISSING',
        count: 1,
        severity: 'monitor',
      }),
    ]);
    expect(
      getAgentCommerceCrawlerStatusReason(crawler, 'agentic_action_health_ok')
    ).toBe('agent_commerce_crawler_fetch_failures');
  });

  it('does not let monitor-only crawler issues override attention fallbacks', () => {
    const crawler = {
      issue_count: 1,
      issues: [
        {
          code: 'crawler_visibility_missing' as const,
          count: 1,
          message: 'missing',
          severity: 'monitor' as const,
        },
      ],
      status: 'monitor' as const,
      summary: null,
      window_days: 14,
    };

    expect(
      getAgentCommerceCrawlerStatusReason(
        crawler,
        'agent_commerce_feed_generation_failed'
      )
    ).toBe('agent_commerce_feed_generation_failed');
    expect(
      getAgentCommerceCrawlerStatusReason(
        crawler,
        'agentic_action_health_monitor'
      )
    ).toBe('agent_commerce_crawler_visibility_missing');
  });

  it('loads recent crawler logs for the merchant and returns ok for AI-agent visits', async () => {
    const crawlerQuery = {
      eq: vi.fn(),
      gte: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: [
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
        error: null,
      }),
      order: vi.fn(),
      select: vi.fn(),
    };
    crawlerQuery.select.mockReturnValue(crawlerQuery);
    crawlerQuery.eq.mockReturnValue(crawlerQuery);
    crawlerQuery.gte.mockReturnValue(crawlerQuery);
    crawlerQuery.order.mockReturnValue(crawlerQuery);
    const supabase = { from: vi.fn(() => crawlerQuery) };

    await expect(
      checkAgentCommerceCrawlerHealth(supabase as never, 'merchant-1')
    ).resolves.toMatchObject({
      issue_count: 0,
      status: 'ok',
      summary: {
        health: {
          aiAgentCrawls: 1,
          failedCrawls: 0,
        },
      },
      window_days: 14,
    });
    expect(supabase.from).toHaveBeenCalledWith('crawler_logs');
    expect(crawlerQuery.select).toHaveBeenCalledWith(
      'agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent'
    );
    expect(crawlerQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(crawlerQuery.gte).toHaveBeenCalledWith(
      'crawled_at',
      expect.any(String)
    );
    expect(crawlerQuery.order).toHaveBeenCalledWith('crawled_at', {
      ascending: false,
    });
    expect(crawlerQuery.limit).toHaveBeenCalledWith(1000);
  });

  it('returns attention when crawler logs cannot be loaded', async () => {
    const crawlerQuery = {
      eq: vi.fn(),
      gte: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('database unavailable'),
      }),
      order: vi.fn(),
      select: vi.fn(),
    };
    crawlerQuery.select.mockReturnValue(crawlerQuery);
    crawlerQuery.eq.mockReturnValue(crawlerQuery);
    crawlerQuery.gte.mockReturnValue(crawlerQuery);
    crawlerQuery.order.mockReturnValue(crawlerQuery);
    const supabase = { from: vi.fn(() => crawlerQuery) };

    await expect(
      checkAgentCommerceCrawlerHealth(supabase as never, 'merchant-1')
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'crawler_log_unavailable',
          count: 1,
          severity: 'attention',
        },
      ],
      status: 'attention',
      summary: null,
    });
  });
});

describe('agentic commerce health summaries', () => {
  const actions = [
    {
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No issues',
      severity: 'ok' as const,
    },
    {
      code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
      count: 2,
      message: 'Drift',
      severity: 'attention' as const,
    },
  ];

  it('summarizes non-zero actions', () => {
    expect(summarizeAgenticCommerceHealthActions(actions)).toEqual([
      {
        code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
        count: 2,
        severity: 'attention',
      },
    ]);
  });

  it('returns ok when no health actions need attention', () => {
    expect(getAgenticCommerceHealthStatus([])).toBe('ok');
  });

  it('returns attention when any attention action has a count', () => {
    expect(getAgenticCommerceHealthStatus(actions)).toBe('attention');
  });

  it('returns monitor when only monitor actions have counts', () => {
    expect(
      getAgenticCommerceHealthStatus([
        { ...actions[1], count: 1, severity: 'monitor' },
      ])
    ).toBe('monitor');
  });
});

describe('fetchPrimaryAgenticMerchantDomains', () => {
  it('returns an empty map without querying when no merchants are supplied', async () => {
    const supabase = { from: vi.fn() };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, [])
    ).resolves.toEqual(new Map());
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('loads active primary domains for monitored merchants', async () => {
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: [{ domain: 'ogabassey.com', merchant_id: 'merchant-1' }],
        error: null,
      });
    const supabase = {
      from: vi.fn(() => domainQuery),
    };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-1'])
    ).resolves.toEqual(new Map([['merchant-1', 'ogabassey.com']]));
    expect(supabase.from).toHaveBeenCalledWith('domains');
    expect(domainQuery.select).toHaveBeenCalledWith('merchant_id, domain');
    expect(domainQuery.in).toHaveBeenCalledWith('merchant_id', ['merchant-1']);
    expect(domainQuery.eq).toHaveBeenCalledWith('is_primary', true);
    expect(domainQuery.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when the domains query fails', async () => {
    const error = new Error('boom');
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: null,
        error,
      });
    const supabase = { from: vi.fn(() => domainQuery) };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-1'])
    ).rejects.toBe(error);
  });

  it('filters rows missing merchant ids or domains', async () => {
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: [
          { domain: 'missing-id.example', merchant_id: null },
          { domain: null, merchant_id: 'merchant-1' },
          { domain: 'valid.example', merchant_id: 'merchant-2' },
        ],
        error: null,
      });
    const supabase = { from: vi.fn(() => domainQuery) };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-2'])
    ).resolves.toEqual(new Map([['merchant-2', 'valid.example']]));
  });
});
