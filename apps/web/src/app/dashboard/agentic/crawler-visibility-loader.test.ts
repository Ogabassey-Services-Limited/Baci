import { describe, expect, it, vi } from 'vitest';
import { loadAgenticCrawlerVisibility } from './crawler-visibility-loader';

function createCrawlerQuery(rows: unknown[]) {
  const query = {
    eq: vi.fn(),
    gte: vi.fn(),
    limit: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  for (const method of [
    query.select,
    query.eq,
    query.gte,
    query.lte,
    query.order,
    query.or,
  ]) {
    method.mockReturnValue(query);
  }
  query.limit.mockResolvedValue({ data: rows, error: null });
  return query;
}

describe('loadAgenticCrawlerVisibility', () => {
  it('scopes crawler activity to the merchant and omits database ids from the summary', async () => {
    const query = createCrawlerQuery([
      {
        agent_family: 'openai',
        bot_name: 'GPTBot',
        cache_outcome: 'hit',
        crawled_at: '2026-07-30T12:00:00.000Z',
        host: 'shop.example.com',
        id: 'internal-log-id',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/products',
        user_agent: 'GPTBot/1.0',
      },
    ]);
    const supabase = { from: vi.fn(() => query) };

    const result = await loadAgenticCrawlerVisibility(
      supabase as never,
      'merchant-1'
    );

    expect(supabase.from).toHaveBeenCalledWith('crawler_logs');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(result.totalCrawls).toBe(1);
    expect(result.recent[0]).toMatchObject({ url_path: '/products' });
    expect(result.recent[0]).not.toHaveProperty('id');
    expect(result.isPartial).toBe(false);
  });
});
