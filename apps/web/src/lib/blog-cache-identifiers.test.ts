import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantBlogCacheIdentifiers } from '@/lib/blog-cache-identifiers';

function createSupabaseMock(response: {
  data: { slug?: string | null } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe('getMerchantBlogCacheIdentifiers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the merchant slug when present', async () => {
    const supabase = createSupabaseMock({
      data: { slug: 'test-store' },
      error: null,
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-1')
    ).resolves.toEqual(['test-store']);
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(supabase.select).toHaveBeenCalledWith('slug');
    expect(supabase.eq).toHaveBeenCalledWith('id', 'merchant-1');
  });

  it('returns an empty array when no merchant record is found', async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-2')
    ).resolves.toEqual([]);
  });

  it('returns an empty array when the merchant slug is null', async () => {
    const supabase = createSupabaseMock({
      data: { slug: null },
      error: null,
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-3')
    ).resolves.toEqual([]);
  });

  it('logs and returns an empty array when Supabase returns an error', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-4')
    ).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog cache identifiers:',
      expect.objectContaining({
        merchantId: 'merchant-4',
        error: { message: 'query failed' },
      })
    );
  });
});
