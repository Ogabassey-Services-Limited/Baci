import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP,
  PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS,
} from '@/lib/payments/paid-order-side-effect-retry-policy';
import { recoverStrandedPaidOrderSideEffects } from '@/lib/payments/recover-stranded-paid-order-side-effects';

const NOW = new Date('2026-07-23T12:00:00.000Z');
// Older than the 24h throttle window → eligible for a reset.
const STALE_CLAIMED_AT = '2026-07-20T12:00:00.000Z';
// Inside the 24h window → attempted recently, must be classed stranded.
const RECENT_CLAIMED_AT = '2026-07-23T11:00:00.000Z';
const MISSING_COLUMN_ERROR =
  'merchant_fetch_error: column merchants.website_url does not exist';

type CappedRow = {
  order_id: string;
  step: string;
  attempts: number;
  error: string | null;
  claimed_at: string | null;
};

function cappedRow(overrides: Partial<CappedRow> = {}): CappedRow {
  return {
    attempts: 5,
    claimed_at: STALE_CLAIMED_AT,
    error: MISSING_COLUMN_ERROR,
    order_id: 'order-1',
    step: 'paid_email',
    ...overrides,
  };
}

function buildSupabase({
  lookup,
  update = { data: [{ order_id: 'order-1' }] },
}: {
  lookup: { data?: unknown[]; error?: unknown };
  update?: { data?: unknown[]; error?: unknown };
}) {
  const selectFilters: [string, ...unknown[]][] = [];
  const updateFilters: [string, ...unknown[]][] = [];
  const updatePayloads: Record<string, unknown>[] = [];

  const from = vi.fn(() => {
    const lookupChain: Record<string, unknown> = {};
    for (const method of ['eq', 'gte', 'not', 'in', 'is', 'order']) {
      lookupChain[method] = vi.fn((...args: unknown[]) => {
        selectFilters.push([method, ...args]);
        return lookupChain;
      });
    }
    lookupChain.limit = vi.fn((n: number) => {
      selectFilters.push(['limit', n]);
      return Promise.resolve({ data: null, error: null, ...lookup });
    });

    return {
      select: vi.fn((sel: string) => {
        selectFilters.push(['select', sel]);
        return lookupChain;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        const updateChain: Record<string, unknown> = {};
        for (const method of ['eq', 'gte']) {
          updateChain[method] = vi.fn((...args: unknown[]) => {
            updateFilters.push([method, ...args]);
            return updateChain;
          });
        }
        updateChain.select = vi.fn(() =>
          Promise.resolve({ data: null, error: null, ...update })
        );
        return updateChain;
      }),
    };
  });

  return {
    selectFilters,
    supabase: { from } as unknown as SupabaseClient,
    updateFilters,
    updatePayloads,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recoverStrandedPaidOrderSideEffects', () => {
  it('only selects capped, non-permanent, replayable rows on paid, non-cancelled orders', async () => {
    const { supabase, selectFilters } = buildSupabase({
      lookup: { data: [] },
    });

    await recoverStrandedPaidOrderSideEffects({ now: NOW, supabase });

    // Eligibility filters (invariant #3) must be pinned, not just the reset.
    expect(selectFilters).toEqual(
      expect.arrayContaining([
        ['eq', 'status', 'failed'],
        ['gte', 'attempts', PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP],
        [
          'not',
          'error',
          'in',
          `(${PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS.join(',')})`,
        ],
        [
          'in',
          'step',
          ['paid_email', 'ad_tracking_conversion', 'merchant_settlement'],
        ],
        ['eq', 'transactions.status', 'completed'],
        ['eq', 'orders.payment_status', 'paid'],
        ['is', 'orders.cancelled_at', null],
        // Oldest attempt first so a backlog > limit drains without starvation.
        ['order', 'claimed_at', { ascending: true }],
      ])
    );
  });

  it('resets a capped row last attempted before the throttle window and reports it', async () => {
    const { supabase, updatePayloads, updateFilters } = buildSupabase({
      lookup: { data: [cappedRow()] },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([
      { orderId: 'order-1', step: 'paid_email' },
    ]);
    expect(summary.stranded).toEqual([]);
    // One fresh attempt (cap - 1 = 4); no `result` write (the throttle keys on
    // claimed_at, which markFailed cannot clobber).
    expect(updatePayloads).toEqual([{ attempts: 4 }]);
    // Compare-and-swap guard: the reset re-asserts the eligibility predicate so
    // a concurrently re-claimed row is a no-op.
    expect(updateFilters).toEqual([
      ['eq', 'order_id', 'order-1'],
      ['eq', 'step', 'paid_email'],
      ['eq', 'status', 'failed'],
      ['gte', 'attempts', PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP],
    ]);
  });

  it('classifies a row attempted within the throttle window as stranded without resetting it', async () => {
    const { supabase, updatePayloads } = buildSupabase({
      lookup: { data: [cappedRow({ claimed_at: RECENT_CLAIMED_AT })] },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([]);
    expect(summary.stranded).toEqual([
      { error: MISSING_COLUMN_ERROR, orderId: 'order-1', step: 'paid_email' },
    ]);
    // A row still inside its throttle window is never reset again.
    expect(updatePayloads).toEqual([]);
  });

  it('treats a row last attempted exactly at the window boundary as stale (recovered)', async () => {
    const boundaryClaimedAt = new Date(
      NOW.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const { supabase } = buildSupabase({
      lookup: { data: [cappedRow({ claimed_at: boundaryClaimedAt })] },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([
      { orderId: 'order-1', step: 'paid_email' },
    ]);
    expect(summary.stranded).toEqual([]);
  });

  it('partitions a mixed batch: stale rows recovered, recently attempted rows stranded', async () => {
    const { supabase, updatePayloads } = buildSupabase({
      lookup: {
        data: [
          cappedRow({ order_id: 'stale-1', step: 'paid_email' }),
          cappedRow({
            claimed_at: RECENT_CLAIMED_AT,
            order_id: 'recent-1',
            step: 'merchant_settlement',
          }),
          cappedRow({ order_id: 'stale-2', step: 'ad_tracking_conversion' }),
        ],
      },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([
      { orderId: 'stale-1', step: 'paid_email' },
      { orderId: 'stale-2', step: 'ad_tracking_conversion' },
    ]);
    expect(summary.stranded).toEqual([
      {
        error: MISSING_COLUMN_ERROR,
        orderId: 'recent-1',
        step: 'merchant_settlement',
      },
    ]);
    // Only the two stale rows are reset.
    expect(updatePayloads).toEqual([{ attempts: 4 }, { attempts: 4 }]);
  });

  it('does not reset or strand a row a concurrent actor already re-claimed (guarded update matches no rows)', async () => {
    const { supabase } = buildSupabase({
      lookup: { data: [cappedRow()] },
      update: { data: [] },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([]);
    expect(summary.stranded).toEqual([]);
  });

  it('returns an empty summary when nothing is capped', async () => {
    const { supabase } = buildSupabase({ lookup: { data: [] } });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary).toEqual({ recovered: [], stranded: [] });
  });

  it('surfaces a lookup error without throwing so the drain still runs', async () => {
    const { supabase } = buildSupabase({
      lookup: { error: { message: 'db down' } },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary).toEqual({ recovered: [], stranded: [] });
  });

  it('keeps a row stranded when its reset update errors', async () => {
    const { supabase } = buildSupabase({
      lookup: { data: [cappedRow()] },
      update: { error: { message: 'update failed' } },
    });

    const summary = await recoverStrandedPaidOrderSideEffects({
      now: NOW,
      supabase,
    });

    expect(summary.recovered).toEqual([]);
    expect(summary.stranded).toEqual([
      { error: MISSING_COLUMN_ERROR, orderId: 'order-1', step: 'paid_email' },
    ]);
  });
});
