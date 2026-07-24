import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

// Shared fixtures + Supabase mock for the stranded-recovery tests. Extracted so
// the test file stays under the 300-line per-file cap.

const NOW = new Date('2026-07-23T12:00:00.000Z');
// Older than the 24h throttle window → eligible for a reset.
const STALE_CLAIMED_AT = '2026-07-20T12:00:00.000Z';
// Inside the 24h window → attempted recently, must be classed stranded.
const RECENT_CLAIMED_AT = '2026-07-23T11:00:00.000Z';
const MISSING_COLUMN_ERROR =
  'merchant_fetch_error: column merchants.website_url does not exist';

export type CappedRow = {
  order_id: string;
  step: string;
  status: string;
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
    status: 'failed',
    step: 'paid_email',
    ...overrides,
  };
}

// Records every filter applied to the lookup and reset chains so tests can pin
// the eligibility predicate, not just the returned data. `.limit` resolves the
// lookup; `.update(...).select()` resolves the guarded reset.
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
    for (const method of ['eq', 'gte', 'not', 'or', 'in', 'is', 'order']) {
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

export const recoverStrandedTestKit = {
  buildSupabase,
  cappedRow,
  MISSING_COLUMN_ERROR,
  NOW,
  RECENT_CLAIMED_AT,
  STALE_CLAIMED_AT,
};
