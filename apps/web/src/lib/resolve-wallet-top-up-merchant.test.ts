import { describe, expect, it, vi } from 'vitest';
import { resolveWalletTopUpMerchant } from './resolve-wallet-top-up-merchant';

type Row = { id: string; slug: string };

function makeSupabase(byId: Row | null, bySlug: Row | null) {
  const calls: Array<{ column: string; value: string }> = [];
  const supabase = {
    calls,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => {
          calls.push({ column, value });
          return {
            maybeSingle: vi.fn(async () => ({
              data: column === 'id' ? byId : bySlug,
              error: null,
            })),
          };
        }),
      })),
    })),
  };
  // biome-ignore lint/suspicious/noExplicitAny: thin Supabase test double
  return supabase as any;
}

describe('resolveWalletTopUpMerchant', () => {
  it('returns the id match without attempting the slug lookup', async () => {
    const supabase = makeSupabase({ id: 'm1', slug: 's1' }, null);

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'm1', merchantSlug: 's1' },
      'id, slug'
    );

    expect(result).toEqual({ id: 'm1', slug: 's1' });
    expect(supabase.calls).toEqual([{ column: 'id', value: 'm1' }]);
  });

  it('falls back to slug when a stale merchantId misses', async () => {
    const supabase = makeSupabase(null, { id: 'm2', slug: 's2' });

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'stale', merchantSlug: 's2' },
      'id, slug'
    );

    expect(result).toEqual({ id: 'm2', slug: 's2' });
    expect(supabase.calls).toEqual([
      { column: 'id', value: 'stale' },
      { column: 'slug', value: 's2' },
    ]);
  });

  it('resolves by slug when no merchantId is supplied', async () => {
    const supabase = makeSupabase(null, { id: 'm3', slug: 's3' });

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantSlug: 's3' },
      'id, slug'
    );

    expect(result).toEqual({ id: 'm3', slug: 's3' });
    expect(supabase.calls).toEqual([{ column: 'slug', value: 's3' }]);
  });

  it('returns null when neither id nor slug resolves', async () => {
    const supabase = makeSupabase(null, null);

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'stale', merchantSlug: 'also-stale' },
      'id, slug'
    );

    expect(result).toBeNull();
  });
});
