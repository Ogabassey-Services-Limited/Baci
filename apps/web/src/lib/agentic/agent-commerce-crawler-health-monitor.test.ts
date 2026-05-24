import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentCommerceCrawlerHealthActions,
  checkAgentCommerceCrawlerHealth,
  getAgentCommerceCrawlerStatusReason,
} from './agent-commerce-health-monitor';

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

  it('does not let attention-level crawler issues override specific feed or manifest fallbacks', () => {
    const crawler = {
      issue_count: 1,
      issues: [
        {
          code: 'crawler_fetch_failures' as const,
          count: 2,
          message: 'failed',
          severity: 'attention' as const,
        },
      ],
      status: 'attention' as const,
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
        'agent_commerce_manifest_drift'
      )
    ).toBe('agent_commerce_manifest_drift');
    expect(
      getAgentCommerceCrawlerStatusReason(
        crawler,
        'agentic_action_health_attention'
      )
    ).toBe('agent_commerce_crawler_fetch_failures');
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
