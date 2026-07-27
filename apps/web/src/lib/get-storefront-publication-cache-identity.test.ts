import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getStorefrontPublicationCacheIdentity } from './get-storefront-publication-cache-identity';

function createSupabaseMock(options: {
  aliases?: Array<{ old_slug: string | null }> | null;
  aliasesError?: { message: string } | null;
  currentSlug?: string | null;
  domains?: Array<{ domain: string | null }> | null;
  domainsError?: { message: string } | null;
  merchantError?: { message: string } | null;
}) {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: options.merchantError ? null : { slug: options.currentSlug ?? null },
    error: options.merchantError ?? null,
  });
  const merchantEq = vi.fn().mockReturnValue({
    maybeSingle: merchantMaybeSingle,
  });
  const domainsIn = vi.fn().mockResolvedValue({
    data: options.domains ?? null,
    error: options.domainsError ?? null,
  });
  const domainsEq = vi.fn();
  const domainsQuery = { eq: domainsEq, in: domainsIn };
  domainsEq.mockReturnValue(domainsQuery);

  const aliasesEq = vi.fn().mockResolvedValue({
    data: options.aliases ?? null,
    error: options.aliasesError ?? null,
  });

  const from = vi.fn((table: string) => {
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnValue({ eq: merchantEq }),
      };
    }
    if (table === 'domains') {
      return {
        select: vi.fn().mockReturnValue(domainsQuery),
      };
    }
    if (table === 'merchant_slug_aliases') {
      return {
        select: vi.fn().mockReturnValue({ eq: aliasesEq }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    aliasesEq,
    client: { from } as unknown as SupabaseClient,
    domainsEq,
    domainsIn,
    from,
    merchantEq,
    merchantMaybeSingle,
  };
}

describe('getStorefrontPublicationCacheIdentity', () => {
  it('returns every normalized current, retired, and active custom identity', async () => {
    const supabase = createSupabaseMock({
      aliases: [
        { old_slug: 'old-store' },
        { old_slug: 'OLDER-STORE' },
        { old_slug: ' current-store ' },
        { old_slug: '   ' },
      ],
      currentSlug: 'current-store',
      domains: [
        { domain: 'shop.example.com' },
        { domain: 'WWW.SHOP.EXAMPLE.COM' },
        { domain: ' secondary.example.com ' },
        { domain: null },
      ],
    });

    await expect(
      getStorefrontPublicationCacheIdentity(
        supabase.client,
        'merchant-1',
        ' Current-Store '
      )
    ).resolves.toEqual({
      canonicalMerchantSlug: 'current-store',
      customDomains: [
        'shop.example.com',
        'www.shop.example.com',
        'secondary.example.com',
      ],
      identifiers: [
        'current-store',
        'old-store',
        'older-store',
        'shop.example.com',
        'www.shop.example.com',
        'secondary.example.com',
      ],
      merchantId: 'merchant-1',
      merchantSlugs: ['current-store', 'old-store', 'older-store'],
    });
    expect(supabase.from).toHaveBeenCalledWith('domains');
    expect(supabase.from).toHaveBeenCalledWith('merchant_slug_aliases');
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(supabase.merchantEq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(supabase.domainsEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.domainsEq).toHaveBeenCalledWith('status', 'active');
    expect(supabase.domainsIn).toHaveBeenCalledWith('domain_type', [
      'custom',
      'purchased',
    ]);
    expect(supabase.aliasesEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });

  it('evicts both the captured and refreshed slug across a concurrent rename', async () => {
    const supabase = createSupabaseMock({
      aliases: [],
      currentSlug: 'new-store',
      domains: [],
    });

    await expect(
      getStorefrontPublicationCacheIdentity(
        supabase.client,
        'merchant-rename',
        'old-store'
      )
    ).resolves.toMatchObject({
      canonicalMerchantSlug: 'new-store',
      identifiers: ['new-store', 'old-store'],
      merchantSlugs: ['new-store', 'old-store'],
    });
  });

  it('fails closed when the current-slug refresh fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      aliases: [],
      domains: [],
      merchantError: { message: 'merchant lookup failed' },
    });

    await expect(
      getStorefrontPublicationCacheIdentity(
        supabase.client,
        'merchant-lookup-failure',
        'old-store'
      )
    ).rejects.toEqual({ message: 'merchant lookup failed' });
  });

  it('fails closed when the active-domain lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      aliases: [],
      domainsError: { message: 'domain lookup failed' },
    });

    await expect(
      getStorefrontPublicationCacheIdentity(
        supabase.client,
        'merchant-2',
        'store'
      )
    ).rejects.toEqual({ message: 'domain lookup failed' });
  });

  it('fails closed when the retired-slug lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      aliasesError: { message: 'alias lookup failed' },
      domains: [],
    });

    await expect(
      getStorefrontPublicationCacheIdentity(supabase.client, 'merchant-3', null)
    ).rejects.toEqual({ message: 'alias lookup failed' });
  });
});
