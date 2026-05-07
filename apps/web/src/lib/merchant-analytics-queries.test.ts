import { describe, expect, it } from 'vitest';
import { fetchMerchantAnalyticsData } from '@/lib/merchant-analytics-queries';

function createSupabaseMock() {
  const chains: Array<{
    table: string;
    calls: Array<{ method: string; args: unknown[] }>;
  }> = [];

  function makeChain(table: string) {
    const record = {
      table,
      calls: [] as Array<{ method: string; args: unknown[] }>,
    };
    chains.push(record);
    const chain = Promise.resolve({
      count: 0,
      data: [] as unknown[],
      error: null,
    }) as unknown as Promise<{
      count: number;
      data: unknown[];
      error: null;
    }> &
      Record<string, unknown>;
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        record.calls.push({ method, args });
        return chain;
      };

    for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit']) {
      chain[method] = passthrough(method);
    }
    return chain;
  }

  return {
    chains,
    from: (table: string) => makeChain(table),
  };
}

describe('fetchMerchantAnalyticsData', () => {
  it('filters only order-backed analytics queries by branch id', async () => {
    const supabase = createSupabaseMock();

    await fetchMerchantAnalyticsData(
      supabase as never,
      'merchant-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-05T00:00:00.000Z'),
      new Date('2026-04-26T00:00:00.000Z'),
      new Date('2026-04-30T00:00:00.000Z'),
      'branch-1'
    );

    expect(
      supabase.chains.flatMap((chain) =>
        chain.calls
          .filter(
            (call) =>
              call.method === 'eq' &&
              (call.args[0] === 'branch_id' ||
                call.args[0] === 'orders.branch_id')
          )
          .map((call) => ({
            table: chain.table,
            column: call.args[0],
            value: call.args[1],
          }))
      )
    ).toEqual([
      { table: 'orders', column: 'branch_id', value: 'branch-1' },
      { table: 'orders', column: 'branch_id', value: 'branch-1' },
      {
        table: 'order_items',
        column: 'orders.branch_id',
        value: 'branch-1',
      },
      {
        table: 'order_items',
        column: 'orders.branch_id',
        value: 'branch-1',
      },
      { table: 'orders', column: 'branch_id', value: 'branch-1' },
      { table: 'orders', column: 'branch_id', value: 'branch-1' },
    ]);

    const blogQuery = supabase.chains.find(
      (chain) => chain.table === 'blog_posts'
    );
    expect(
      blogQuery?.calls.filter((call) => call.args[0] === 'branch_id')
    ).toEqual([]);
  });
});
