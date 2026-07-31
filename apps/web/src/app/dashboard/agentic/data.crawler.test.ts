import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCrawlerLogQuery,
  resetAgenticDataMocks,
  supabaseFrom,
} from './data.test-support';

describe('loadAgenticCentersData', () => {
  beforeEach(resetAgenticDataMocks);
  it('trims recent crawler rows while preserving aggregate counts', async () => {
    const manyCrawlerRows = [0, 1, 2, 3, 4].map((index) => ({
      agent_family: 'openai',
      bot_name: 'OpenAI',
      cache_outcome: index === 4 ? 'miss' : 'hit',
      crawled_at: `2026-05-20T05:0${index}:00.000Z`,
      host: 'shop.example.com',
      id: `crawler-row-${index}`,
      response_time_ms: 120,
      status_code: 200,
      url_path: `/agent-page-${index}`,
      user_agent: 'GPTBot/1.0',
    }));
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({ data: manyCrawlerRows });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary).toMatchObject({
      health: {
        aiAgentCrawls: 5,
        cacheMissCrawls: 1,
      },
      totalCrawls: 5,
    });
    expect(result.crawlerSummary?.recent).toHaveLength(3);
    expect(result.crawlerSummary?.recent.map((row) => row.url_path)).toEqual([
      '/agent-page-4',
      '/agent-page-3',
      '/agent-page-2',
    ]);
    expect(result.crawlerSummary?.recent[0]).not.toHaveProperty('id');
  });

  it('orders same-timestamp crawler rows by id before trimming recent activity', async () => {
    const tiedCrawlerRows = [
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-001',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-low',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-003',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-high',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-002',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-mid',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T04:59:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-004',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-older',
        user_agent: 'GPTBot/1.0',
      },
    ];
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({ data: tiedCrawlerRows });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.recent.map((row) => row.url_path)).toEqual([
      '/agent-page-high',
      '/agent-page-mid',
      '/agent-page-low',
    ]);
  });

  it('pages crawler rows before building aggregate counts', async () => {
    const paginatedCrawlerRows = Array.from(
      { length: 1001 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T05:${String(index % 60).padStart(2, '0')}:00.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(4, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({
      data: paginatedCrawlerRows,
    });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(1001);
    expect(result.crawlerSummary?.health.aiAgentCrawls).toBe(1001);
    expect(result.crawlerSummary?.isPartial).toBe(false);
    expect(crawlerLogQuery.order).toHaveBeenNthCalledWith(1, 'crawled_at', {
      ascending: false,
    });
    expect(crawlerLogQuery.order).toHaveBeenNthCalledWith(2, 'id', {
      ascending: false,
    });
    expect(crawlerLogQuery.limit).toHaveBeenCalledTimes(2);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(1, 1000);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(2, 1000);
    expect(crawlerLogQuery.lte).toHaveBeenCalledWith(
      'crawled_at',
      expect.any(String)
    );
    expect(crawlerLogQuery.or).toHaveBeenCalledTimes(1);
    expect(crawlerLogQuery.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^crawled_at\.lt\..*,and\(crawled_at\.eq\..*,id\.lt\..*\)$/
      )
    );
  });

  it('caps crawler aggregation after the maximum page window', async () => {
    const cappedCrawlerRows = Array.from(
      { length: 10_001 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T${String(Math.floor(index / 3600)).padStart(2, '0')}:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(5, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({ data: cappedCrawlerRows });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(10_000);
    expect(result.crawlerSummary?.isPartial).toBe(true);
    expect(crawlerLogQuery.limit).toHaveBeenCalledTimes(11);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(10, 1000);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(11, 1);
  });

  it('does not mark crawler aggregation partial at the exact page cap', async () => {
    const cappedCrawlerRows = Array.from(
      { length: 10_000 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T${String(Math.floor(index / 3600)).padStart(2, '0')}:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(5, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({ data: cappedCrawlerRows });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(10_000);
    expect(result.crawlerSummary?.isPartial).toBe(false);
    expect(crawlerLogQuery.limit).toHaveBeenCalledTimes(11);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(10, 1000);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(11, 1);
  });
});
