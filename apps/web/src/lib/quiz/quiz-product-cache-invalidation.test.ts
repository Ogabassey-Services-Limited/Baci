import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExpireProductBlogCache } = vi.hoisted(() => ({
  mockExpireProductBlogCache: vi.fn(),
}));

vi.mock('@/lib/expire-product-blog-cache', () => ({
  expireProductBlogCache: mockExpireProductBlogCache,
}));

import { invalidateQuizProductCaches } from './quiz-product-cache-invalidation';

function createClient() {
  const eventRows = [
    { merchant_id: 'merchant-1', settings: { prize_product_id: 'product-1' } },
    { merchant_id: 'merchant-2', settings: { title: 'Trivia only' } },
  ];
  const awardRows = [{ event_id: 'event-2', product_id: 'product-2' }];
  const expiredEventRows = [{ merchant_id: 'merchant-2' }];
  return {
    from: vi.fn((table: string) => {
      const rows: unknown[] =
        table === 'quiz_events'
          ? eventRows
          : table === 'quiz_awards'
            ? awardRows
            : [];
      const builder = {
        data: rows,
        error: null,
        select: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        not: vi.fn(() => builder),
        in: vi.fn(() => {
          builder.data = table === 'quiz_events' ? expiredEventRows : rows;
          return builder;
        }),
      };
      return builder;
    }),
  };
}

describe('invalidateQuizProductCaches', () => {
  beforeEach(() => {
    mockExpireProductBlogCache.mockReset();
  });

  it('expires merchant tags for changed prize events and expired awards', async () => {
    const client = createClient();

    await invalidateQuizProductCaches(client as never, '2026-09-01T00:00:00Z');

    expect(mockExpireProductBlogCache).toHaveBeenCalledWith('merchant-1');
    expect(mockExpireProductBlogCache).toHaveBeenCalledWith('merchant-2');
    expect(mockExpireProductBlogCache).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate non-product quiz events', async () => {
    const client = createClient();
    client.from = vi.fn(() => ({
      data: [{ merchant_id: 'merchant-2', settings: { title: 'Trivia only' } }],
      error: null,
      select: vi.fn(function (this: unknown) {
        return this;
      }),
      gte: vi.fn(function (this: unknown) {
        return this;
      }),
      limit: vi.fn(function (this: unknown) {
        return this;
      }),
      not: vi.fn(function (this: unknown) {
        return this;
      }),
      in: vi.fn(function (this: unknown) {
        return this;
      }),
    })) as never;

    await invalidateQuizProductCaches(client as never, '2026-09-01T00:00:00Z');

    expect(mockExpireProductBlogCache).not.toHaveBeenCalled();
  });
});
