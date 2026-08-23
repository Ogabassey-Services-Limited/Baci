import { describe, expect, it, vi } from 'vitest';
import { fetchPaidOrdersForAnalytics } from './fetch-paid-orders';

function createQuery(range: (from: number, to: number) => Promise<unknown>) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['eq', 'gte', 'lte', 'order', 'select']) {
    query[method] = vi.fn(() => query);
  }
  query.range = vi.fn(range);
  return query;
}

describe('fetchPaidOrdersForAnalytics', () => {
  it('reads every page with a deterministic order', async () => {
    const pages = new Map<number, unknown>([
      [
        0,
        {
          data: Array.from({ length: 500 }, (_, index) => ({
            ad_tracking: { gclid: `first-${index}` },
            created_at: '2026-08-01T00:00:00.000Z',
            id: `order-${index + 1}`,
            payment_status: 'paid',
            total: 100,
          })),
          error: null,
        },
      ],
      [
        500,
        {
          data: [
            {
              ad_tracking: { gclid: 'second' },
              created_at: '2026-08-02T00:00:00.000Z',
              id: 'order-501',
              payment_status: 'paid',
              total: 200,
            },
          ],
          error: null,
        },
      ],
    ]);
    const query = createQuery(
      async (from) => pages.get(from) ?? { data: [], error: null }
    );
    const from = vi.fn(() => query);

    const result = await fetchPaidOrdersForAnalytics(
      { from } as never,
      'merchant-1',
      '2026-08-01T00:00:00.000Z',
      '2026-08-02T23:59:59.999Z'
    );

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(501);
    expect(result.data[0]?.id).toBe('order-1');
    expect(result.data.at(-1)?.id).toBe('order-501');
    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', {
      ascending: true,
    });
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(query.range).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it('returns the database error without exposing a partial order set', async () => {
    const databaseError = { message: 'orders unavailable' };
    const query = createQuery(async () => ({
      data: null,
      error: databaseError,
    }));

    const result = await fetchPaidOrdersForAnalytics(
      { from: vi.fn(() => query) } as never,
      'merchant-1',
      '2026-08-01T00:00:00.000Z',
      '2026-08-02T23:59:59.999Z'
    );

    expect(result).toEqual({ data: [], error: databaseError });
  });
});
