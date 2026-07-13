import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { OpenAIFeedProduct } from './feed-data';
import { hydrateOpenAIFeedProductsWithReviewSignals } from './feed-review-signals';

type ReviewFixture = {
  product_id: string | null;
  rating: number | string | null;
};

type ReviewRangeResult = {
  count?: number | null;
  data: ReviewFixture[] | null;
  error: unknown;
};

const productFixture = (id: string): OpenAIFeedProduct => ({
  description: 'A phone',
  id,
  name: 'Test Phone',
  price: 50000,
  stock: 5,
});

function createReviewSupabaseMock(results: ReviewRangeResult[]) {
  const rangeResults = [...results];
  const from = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const inFilter = vi.fn();
  const order = vi.fn();
  const range = vi.fn();

  const query = {
    eq: (column: string, value: unknown) => {
      eq(column, value);
      return query;
    },
    in: (column: string, values: string[]) => {
      inFilter(column, values);
      return query;
    },
    order: (column: string, options?: { ascending: boolean }) => {
      order(column, options);
      return query;
    },
    range: (fromValue: number, toValue: number) => {
      range(fromValue, toValue);
      return Promise.resolve(
        rangeResults.shift() ?? {
          count: 0,
          data: [],
          error: null,
        }
      );
    },
    select: (columns: string, options?: { count: 'exact' }) => {
      select(columns, options);
      return query;
    },
  };

  from.mockReturnValue(query);

  return {
    calls: { eq, from, inFilter, order, range, select },
    supabase: { from } as unknown as SupabaseClient,
  };
}

describe('hydrateOpenAIFeedProductsWithReviewSignals', () => {
  it('hydrates approved review counts and average ratings', async () => {
    const { calls, supabase } = createReviewSupabaseMock([
      {
        count: 4,
        data: [
          { product_id: 'prod-1', rating: '4' },
          { product_id: 'prod-1', rating: 5 },
          { product_id: 'prod-1', rating: 6 },
          { product_id: null, rating: 3 },
        ],
        error: null,
      },
    ]);

    const result = await hydrateOpenAIFeedProductsWithReviewSignals(
      supabase,
      'merchant-1',
      [productFixture('prod-1'), productFixture('prod-2')]
    );

    expect(calls.from).toHaveBeenCalledWith('product_reviews');
    expect(calls.select).toHaveBeenCalledWith('product_id, rating', {
      count: 'exact',
    });
    expect(calls.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(calls.eq).toHaveBeenCalledWith('status', 'approved');
    expect(calls.inFilter).toHaveBeenCalledWith('product_id', [
      'prod-1',
      'prod-2',
    ]);
    expect(calls.order).toHaveBeenCalledWith('product_id', {
      ascending: true,
    });
    expect(calls.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(calls.range).toHaveBeenCalledWith(0, 999);
    expect(result[0]).toMatchObject({
      average_rating: 4.5,
      review_count: 2,
    });
    expect(result[1]).toMatchObject({
      average_rating: null,
      review_count: 0,
    });
  });

  it('marks review signals unknown when review hydration fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { supabase } = createReviewSupabaseMock([
      {
        data: null,
        error: { message: 'reviews unavailable' },
      },
    ]);

    const result = await hydrateOpenAIFeedProductsWithReviewSignals(
      supabase,
      'merchant-1',
      [productFixture('prod-1')]
    );

    expect(result[0]).toMatchObject({
      average_rating: null,
      review_count: null,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'DB_REVIEW_SIGNAL_WARNING:',
      expect.objectContaining({
        merchantId: 'merchant-1',
        productCount: 1,
      })
    );
    warnSpy.mockRestore();
  });
});
