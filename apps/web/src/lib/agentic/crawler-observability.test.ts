import { describe, expect, it } from 'vitest';
import {
  buildCrawlerLogSummary,
  classifyCrawlerUserAgent,
  createCrawlerLogSummaryAccumulator,
  getCrawlerClassificationForEvent,
  normalizeCrawlerHost,
  normalizeCrawlerPath,
} from '@/lib/agentic/crawler-observability';

describe('crawler observability helpers', () => {
  it.each([
    ['GPTBot/1.0', 'openai', true],
    ['Googlebot/2.1', 'google', true],
    ['ClaudeBot', 'anthropic', true],
    ['Claude-User', 'anthropic', true],
    ['Claude-SearchBot', 'anthropic', true],
    ['PerplexityBot', 'perplexity', true],
    ['Bingbot', 'search', false],
    ['InternalAgent', 'generic-agent', true],
  ])('classifies %s as %s', (userAgent, family, isAiAgent) => {
    expect(classifyCrawlerUserAgent(userAgent)).toMatchObject({
      family,
      isAiAgent,
    });
  });

  it('prefers an explicit bot name while preserving classified family', () => {
    expect(
      getCrawlerClassificationForEvent({
        botName: 'ChatGPT Shopping',
        userAgent: 'GPTBot/1.0',
      })
    ).toMatchObject({
      botName: 'ChatGPT Shopping',
      family: 'openai',
    });
  });

  it('normalizes hosts and route paths', () => {
    expect(normalizeCrawlerHost('https://WWW.Ogabassey.COM/path')).toBe(
      'www.ogabassey.com'
    );
    expect(normalizeCrawlerHost('ogabassey.com:443')).toBe('ogabassey.com');
    expect(
      normalizeCrawlerPath('https://ogabassey.com/products?q=iphone')
    ).toBe('/products?q=iphone');
    expect(normalizeCrawlerPath('agent-commerce.json')).toBe(
      '/agent-commerce.json'
    );
  });

  it('builds crawler health and aggregation summaries', () => {
    const summary = buildCrawlerLogSummary(
      [
        {
          agent_family: 'openai',
          bot_name: 'OpenAI',
          cache_outcome: 'miss',
          crawled_at: '2026-05-20T01:00:00.000Z',
          host: 'ogabassey.com',
          response_time_ms: 3200,
          status_code: 200,
          url_path: '/agent-commerce.json?x=1',
          user_agent: 'GPTBot/1.0',
        },
        {
          agent_family: 'search',
          bot_name: 'Bing',
          cache_outcome: 'hit',
          crawled_at: '2026-05-20T02:00:00.000Z',
          host: 'ogabassey.com',
          response_time_ms: 120,
          status_code: 404,
          url_path: '/missing',
          user_agent: 'Bingbot',
        },
      ],
      7
    );

    expect(summary.totalCrawls).toBe(2);
    expect(summary.isPartial).toBe(false);
    expect(summary.byBot.find((bot) => bot.family === 'openai')).toMatchObject({
      count: 1,
      family: 'openai',
      name: 'OpenAI',
    });
    expect(summary.topPages).toEqual([
      { count: 1, path: '/agent-commerce.json' },
      { count: 1, path: '/missing' },
    ]);
    expect(summary.health).toEqual({
      aiAgentCrawls: 1,
      cacheMissCrawls: 1,
      failedCrawls: 1,
      lastAgentCrawlAt: '2026-05-20T01:00:00.000Z',
      slowCrawls: 1,
    });
  });

  it('uses the user-agent classification when legacy rows do not have a bot name', () => {
    const summary = buildCrawlerLogSummary(
      [
        {
          agent_family: null,
          bot_name: null,
          cache_outcome: null,
          crawled_at: '2026-05-20T01:00:00.000Z',
          host: 'ogabassey.com',
          response_time_ms: null,
          status_code: 200,
          url_path: '/agent-commerce.json',
          user_agent: 'GPTBot/1.0',
        },
      ],
      7
    );

    expect(summary.byBot).toEqual([
      {
        count: 1,
        family: 'openai',
        lastCrawledAt: '2026-05-20T01:00:00.000Z',
        name: 'OpenAI',
      },
    ]);
  });

  it('accumulates paged summaries while keeping only the requested recent rows', () => {
    const accumulator = createCrawlerLogSummaryAccumulator(14, {
      recentLimit: 2,
    });

    accumulator.addRows([
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T03:00:00.000Z',
        host: 'ogabassey.com',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/latest',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T02:00:00.000Z',
        host: 'ogabassey.com',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/second',
        user_agent: 'GPTBot/1.0',
      },
    ]);
    const firstSummary = accumulator.toSummary();
    accumulator.addRows([
      {
        agent_family: 'search',
        bot_name: 'Bing',
        cache_outcome: 'miss',
        crawled_at: '2026-05-20T01:00:00.000Z',
        host: 'ogabassey.com',
        response_time_ms: 3200,
        status_code: 404,
        url_path: '/older',
        user_agent: 'Bingbot',
      },
    ]);

    const summary = accumulator.toSummary();

    expect(firstSummary.recent.map((row) => row.url_path)).toEqual([
      '/latest',
      '/second',
    ]);
    expect(summary.totalCrawls).toBe(3);
    expect(summary.recent.map((row) => row.url_path)).toEqual([
      '/latest',
      '/second',
    ]);
    expect(summary.health).toMatchObject({
      aiAgentCrawls: 2,
      cacheMissCrawls: 1,
      failedCrawls: 1,
      slowCrawls: 1,
    });
  });
});
