import { describe, expect, it } from 'vitest';
import {
  createSupabaseOrderQueryFake,
  type FakeOrderRow,
} from './supabase-order-query-fake';

function row(id: string, createdAt: string, email = `${id}@example.com`) {
  return {
    created_at: createdAt,
    customer_email: email,
    customer_id: null,
    customer_name: `Buyer ${id}`,
    customer_phone: '+2348012345678',
    id,
    order_number: `ORD-${id}`,
    payment_method: 'paystack',
    payment_status: 'unpaid',
    total: 1000,
    transactions: [],
  } satisfies FakeOrderRow;
}

/**
 * A fake that silently ignores constraints is worse than no fake — it makes
 * unbounded-query regressions look covered. These assert it honours them.
 */
describe('createSupabaseOrderQueryFake', () => {
  it('filters rows below the gte bound', async () => {
    const fake = createSupabaseOrderQueryFake([
      row('old', '2026-01-01T00:00:00.000Z'),
      row('new', '2026-06-01T00:00:00.000Z'),
    ]);

    const { data } = await fake
      .from()
      .gte('created_at', '2026-03-01T00:00:00.000Z');

    expect(data.map((r) => r.id)).toEqual(['new']);
  });

  it('caps the row count at the limit', async () => {
    const fake = createSupabaseOrderQueryFake([
      row('a', '2026-06-03T00:00:00.000Z'),
      row('b', '2026-06-02T00:00:00.000Z'),
      row('c', '2026-06-01T00:00:00.000Z'),
    ]);

    const { data } = await fake.from().limit(2);

    expect(data).toHaveLength(2);
  });

  it('orders descending and applies the limit after ordering', async () => {
    const fake = createSupabaseOrderQueryFake([
      row('oldest', '2026-06-01T00:00:00.000Z'),
      row('newest', '2026-06-03T00:00:00.000Z'),
      row('middle', '2026-06-02T00:00:00.000Z'),
    ]);

    const { data } = await fake
      .from()
      .order('created_at', { ascending: false })
      .limit(2);

    expect(data.map((r) => r.id)).toEqual(['newest', 'middle']);
  });

  it('returns the error and no rows once an error is set', async () => {
    const fake = createSupabaseOrderQueryFake([
      row('a', '2026-06-01T00:00:00.000Z'),
    ]);
    fake.setError({ message: 'boom' });

    const { data, error } = await fake.from();

    expect(data).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });

  it('records the calls it was given', async () => {
    const fake = createSupabaseOrderQueryFake([]);

    await fake.from().select('id').eq('merchant_id', 'm1').limit(5);

    expect(fake.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id'] },
        { method: 'eq', args: ['merchant_id', 'm1'] },
        { method: 'limit', args: [5] },
      ])
    );
  });
});
