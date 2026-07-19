import { describe, expect, it } from 'vitest';
import { drainFailedPaidOrderSideEffectsTestKit } from '@/lib/payments/drain-failed-paid-order-side-effects.test-helpers';

describe('drainFailedPaidOrderSideEffectsTestKit', () => {
  it('provides the canonical failed row and a chainable Supabase query', async () => {
    const { buildSupabase, failedRow } = drainFailedPaidOrderSideEffectsTestKit;
    const supabase = buildSupabase({ data: [failedRow] });
    const query = supabase.from('payment_side_effects') as unknown as {
      limit: (value: number) => Promise<{ data: unknown[]; error: null }>;
      select: (value: string) => unknown;
    };

    expect(failedRow.transactions.created_at).toBe('2026-07-01T00:00:00.000Z');
    expect(query.select('order_id')).toBe(query);
    await expect(query.limit(10)).resolves.toEqual({
      data: [failedRow],
      error: null,
    });
  });
});
