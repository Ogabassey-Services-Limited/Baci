import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { getAgentCommerceFeedHealthSnapshot } from './agent-commerce-feed-health-snapshot';

interface QueryResult {
  data: unknown[] | null;
  error: unknown | null;
}

interface ProductQueryMock {
  eq: Mock;
  gt: Mock;
  is: Mock;
  limit: Mock;
  not: Mock;
  or: Mock;
  order: Mock;
  select: Mock;
}

function createProductQuery(result: QueryResult) {
  const query = {} as ProductQueryMock;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.not = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.gt = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(async () => result);

  return query;
}

function createSupabaseMock(results: QueryResult[]) {
  const queries = results.map(createProductQuery);
  const pendingQueries = [...queries];
  const from = vi.fn(() => {
    const query = pendingQueries.shift();
    if (!query) throw new Error('Unexpected products query');
    return query;
  });

  return {
    from,
    queries,
    supabase: { from } as unknown as SupabaseClient,
  };
}

describe('getAgentCommerceFeedHealthSnapshot', () => {
  it('uses a narrow products projection for monitor-only feed health', async () => {
    const product = {
      created_at: '2026-05-22T10:00:00.000Z',
      id: 'product-1',
      updated_at: '2026-05-22T11:00:00.000Z',
    };
    const { from, queries, supabase } = createSupabaseMock([
      { data: [product], error: null },
      { data: [], error: null },
    ]);

    const result = await getAgentCommerceFeedHealthSnapshot({
      merchantId: 'merchant-1',
      supabase,
    });

    expect(result).toEqual({
      googleProducts: [product],
      openAiProducts: [product],
    });
    expect(from).toHaveBeenCalledWith('products');
    expect(queries[0].select).toHaveBeenCalledWith(
      'id, created_at, updated_at'
    );
    expect(queries[0].eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(queries[0].eq).toHaveBeenCalledWith('status', 'active');
    expect(queries[0].not).toHaveBeenCalledWith('created_at', 'is', null);
    expect(queries[1].is).toHaveBeenCalledWith('created_at', null);
  });

  it('quotes pagination cursor values before building PostgREST or filters', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      created_at: '2026-05-22T10:00:00.000Z',
      id: index === 999 ? 'product,"reserved"\\backslash' : `product-${index}`,
      updated_at: '2026-05-22T11:00:00.000Z',
    }));
    const { queries, supabase } = createSupabaseMock([
      { data: fullPage, error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    await getAgentCommerceFeedHealthSnapshot({
      merchantId: 'merchant-1',
      supabase,
    });

    expect(queries[1].or).toHaveBeenCalledWith(
      'created_at.lt."2026-05-22T10:00:00.000Z",and(created_at.eq."2026-05-22T10:00:00.000Z",id.gt."product,""reserved""\\backslash")'
    );
  });

  it('surfaces products query errors to the health check caller', async () => {
    const dbError = { message: 'canceling statement due to statement timeout' };
    const { supabase } = createSupabaseMock([{ data: null, error: dbError }]);

    await expect(
      getAgentCommerceFeedHealthSnapshot({
        merchantId: 'merchant-1',
        supabase,
      })
    ).rejects.toBe(dbError);
  });
});
