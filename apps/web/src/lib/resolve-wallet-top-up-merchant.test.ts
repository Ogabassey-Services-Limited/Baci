import { describe, expect, it, vi } from 'vitest';
import { resolveWalletTopUpMerchant } from './resolve-wallet-top-up-merchant';

type Row = { id: string; slug: string };
type SupabaseTestDouble = Parameters<typeof resolveWalletTopUpMerchant>[0] & {
  calls: Array<{ column: string; value: string }>;
  selects: string[];
};

function makeSupabase(byId: Row | null, bySlug: Row | null) {
  const calls: Array<{ column: string; value: string }> = [];
  const selects: string[] = [];
  const supabase = {
    calls,
    selects,
    from: vi.fn(() => ({
      select: vi.fn((columns: string) => {
        selects.push(columns);
        return {
          eq: vi.fn((column: string, value: string) => {
            calls.push({ column, value });
            return {
              maybeSingle: vi.fn(async () => ({
                data: column === 'id' ? byId : bySlug,
                error: null,
              })),
            };
          }),
        };
      }),
    })),
  };
  return supabase as unknown as SupabaseTestDouble;
}

describe('resolveWalletTopUpMerchant', () => {
  it('returns the id match without attempting the slug lookup when both identifiers agree', async () => {
    const supabase = makeSupabase({ id: 'm1', slug: 's1' }, null);

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'm1', merchantSlug: 's1' },
      'id, slug'
    );

    expect(result).toEqual({ id: 'm1', slug: 's1' });
    expect(supabase.calls).toEqual([{ column: 'id', value: 'm1' }]);
  });

  it('selects slug for id lookups so mixed identifiers can be checked for consistency', async () => {
    const supabase = makeSupabase({ id: 'm1', slug: 's1' }, null);

    await resolveWalletTopUpMerchant<{ id: string }>(
      supabase,
      { merchantId: 'm1', merchantSlug: 's1' },
      'id'
    );

    expect(supabase.selects).toEqual(['id, slug']);
  });

  it('falls back to the slug merchant when merchantId resolves to a different slug', async () => {
    const supabase = makeSupabase(
      { id: 'stale-id', slug: 'other-store' },
      { id: 'm2', slug: 's2' }
    );

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'stale-id', merchantSlug: 's2' },
      'id, slug'
    );

    expect(result).toEqual({ id: 'm2', slug: 's2' });
    expect(supabase.calls).toEqual([
      { column: 'id', value: 'stale-id' },
      { column: 'slug', value: 's2' },
    ]);
  });

  it('returns null when merchantId resolves to a different slug and merchantSlug also misses', async () => {
    const supabase = makeSupabase(
      { id: 'stale-id', slug: 'other-store' },
      null
    );

    const result = await resolveWalletTopUpMerchant<Row>(
      supabase,
      { merchantId: 'stale-id', merchantSlug: 'missing-store' },
      'id, slug'
    );

    expect(result).toBeNull();
    expect(supabase.calls).toEqual([
      { column: 'id', value: 'stale-id' },
      { column: 'slug', value: 'missing-store' },
    ]);
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
