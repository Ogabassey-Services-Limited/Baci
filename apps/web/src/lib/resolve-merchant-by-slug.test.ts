import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { resolveMerchantIdBySlugOrAlias } from './resolve-merchant-by-slug';

/**
 * Build a supabase stub whose `.from(table).select().eq().maybeSingle()` resolves
 * to the value provided for that table.
 */
function makeSupabase(
  byTable: Record<string, { data: unknown; error: unknown }>
) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue(byTable[table] ?? { data: null, error: null }),
    })),
  } as unknown as SupabaseClient;
}

describe('resolveMerchantIdBySlugOrAlias', () => {
  it('resolves a live merchant directly, without consulting the alias table', async () => {
    const supabase = makeSupabase({
      merchants: { data: { id: 'merchant-live' }, error: null },
    });
    const result = await resolveMerchantIdBySlugOrAlias(supabase, 'ogabassey');
    expect(result).toEqual({ merchantId: 'merchant-live', error: null });
    expect(supabase.from).not.toHaveBeenCalledWith('merchant_slug_aliases');
  });

  it('falls back to the alias table for a retired slug', async () => {
    const supabase = makeSupabase({
      merchants: { data: null, error: null },
      merchant_slug_aliases: {
        data: { merchant_id: 'merchant-renamed' },
        error: null,
      },
    });
    const result = await resolveMerchantIdBySlugOrAlias(supabase, 'yodhashop');
    expect(result).toEqual({ merchantId: 'merchant-renamed', error: null });
  });

  it('returns null when the slug is neither a live merchant nor a retired alias', async () => {
    const supabase = makeSupabase({
      merchants: { data: null, error: null },
      merchant_slug_aliases: { data: null, error: null },
    });
    const result = await resolveMerchantIdBySlugOrAlias(supabase, 'nope');
    expect(result).toEqual({ merchantId: null, error: null });
  });

  it('surfaces a DB error from the merchants lookup', async () => {
    const dbError = { message: 'boom' };
    const supabase = makeSupabase({
      merchants: { data: null, error: dbError },
    });
    const result = await resolveMerchantIdBySlugOrAlias(supabase, 'x');
    expect(result).toEqual({ merchantId: null, error: dbError });
  });

  it('surfaces a DB error from the alias lookup', async () => {
    const aliasError = { message: 'alias boom' };
    const supabase = makeSupabase({
      merchants: { data: null, error: null },
      merchant_slug_aliases: { data: null, error: aliasError },
    });
    const result = await resolveMerchantIdBySlugOrAlias(supabase, 'x');
    expect(result).toEqual({ merchantId: null, error: aliasError });
  });
});
