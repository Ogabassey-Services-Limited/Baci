import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantBlogCacheIdentifiers,
  getMerchantBlogRevalidationContext,
} from '@/lib/get-merchant-blog-cache-identifiers';

function createSupabaseMock(options: {
  domains?: Array<{ domain: string | null }> | null;
  domainsError?: { message: string } | null;
  merchant?: { slug?: string | null } | null;
  merchantError?: { message: string } | null;
}) {
  const domainsEq = vi.fn().mockReturnThis();
  const domainsIn = vi.fn().mockResolvedValue({
    data: options.domains ?? null,
    error: options.domainsError ?? null,
  });
  const domainsSelect = vi.fn().mockReturnValue({
    eq: domainsEq,
    in: domainsIn,
  });

  domainsEq.mockImplementation(() => ({
    eq: domainsEq,
    in: domainsIn,
  }));

  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: options.merchant ?? null,
    error: options.merchantError ?? null,
  });
  const merchantEq = vi.fn().mockReturnValue({
    maybeSingle: merchantMaybeSingle,
  });
  const merchantSelect = vi.fn().mockReturnValue({
    eq: merchantEq,
  });

  const from = vi.fn((table: string) => {
    if (table === 'merchants') {
      return { select: merchantSelect };
    }

    if (table === 'domains') {
      return { select: domainsSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient,
    domainsEq,
    domainsIn,
    domainsSelect,
    from,
    merchantEq,
    merchantMaybeSingle,
    merchantSelect,
  };
}

describe('getMerchantBlogCacheIdentifiers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the merchant slug and active custom domains', async () => {
    const supabase = createSupabaseMock({
      merchant: { slug: 'Test-Store' },
      domains: [
        { domain: 'ogabassey.com' },
        { domain: 'WWW.OGABASSEY.COM' },
        { domain: '   ' },
        { domain: null },
      ],
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-1')
    ).resolves.toEqual(['test-store', 'ogabassey.com', 'www.ogabassey.com']);
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(supabase.from).toHaveBeenCalledWith('domains');
    expect(supabase.domainsEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.domainsEq).toHaveBeenCalledWith('status', 'active');
    expect(supabase.domainsIn).toHaveBeenCalledWith('domain_type', [
      'custom',
      'purchased',
    ]);
  });

  it('returns an empty array when no merchant record is found', async () => {
    const supabase = createSupabaseMock({
      merchant: null,
      domains: [],
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-2')
    ).resolves.toEqual([]);
  });

  it('filters whitespace-only identifiers after normalization', async () => {
    const supabase = createSupabaseMock({
      merchant: { slug: '   ' },
      domains: [{ domain: '   ' }],
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-3')
    ).resolves.toEqual([]);
  });

  it('throws when the merchant lookup errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      merchantError: { message: 'merchant query failed' },
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-4')
    ).rejects.toEqual({ message: 'merchant query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog cache identifiers:',
      expect.objectContaining({
        merchantId: 'merchant-4',
        error: { message: 'merchant query failed' },
      })
    );
  });

  it('throws when the domain lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      merchant: { slug: 'test-store' },
      domainsError: { message: 'domain query failed' },
    });

    await expect(
      getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-5')
    ).rejects.toEqual({ message: 'domain query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog domain identifiers:',
      expect.objectContaining({
        merchantId: 'merchant-5',
        error: { message: 'domain query failed' },
      })
    );
  });
});

describe('getMerchantBlogRevalidationContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns identifiers plus the canonical merchant slug for mutation revalidation', async () => {
    const supabase = createSupabaseMock({
      merchant: { slug: 'Test-Store' },
      domains: [{ domain: 'shop.example.com' }],
    });

    await expect(
      getMerchantBlogRevalidationContext(supabase.client, 'merchant-1')
    ).resolves.toEqual({
      identifiers: ['test-store', 'shop.example.com'],
      canonicalMerchantSlug: 'test-store',
    });
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(supabase.merchantSelect).toHaveBeenCalledWith('slug');
    expect(supabase.merchantEq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(supabase.merchantMaybeSingle).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('domains');
    expect(supabase.domainsSelect).toHaveBeenCalledWith('domain');
    expect(supabase.domainsEq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(supabase.domainsEq).toHaveBeenCalledWith('status', 'active');
    expect(supabase.domainsIn).toHaveBeenCalledWith('domain_type', [
      'custom',
      'purchased',
    ]);
  });

  it('returns null canonicalMerchantSlug when the merchant has no usable slug', async () => {
    const supabase = createSupabaseMock({
      merchant: { slug: ' ' },
      domains: [{ domain: 'shop.example.com' }],
    });

    await expect(
      getMerchantBlogRevalidationContext(supabase.client, 'merchant-2')
    ).resolves.toEqual({
      identifiers: ['shop.example.com'],
      canonicalMerchantSlug: null,
    });
  });

  it('returns null canonicalMerchantSlug when no merchant record is found', async () => {
    const supabase = createSupabaseMock({
      merchant: null,
      domains: [],
    });

    await expect(
      getMerchantBlogRevalidationContext(supabase.client, 'merchant-3')
    ).resolves.toEqual({
      identifiers: [],
      canonicalMerchantSlug: null,
    });
  });

  it('throws when merchant lookup errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      merchantError: { message: 'merchant query failed' },
    });

    await expect(
      getMerchantBlogRevalidationContext(supabase.client, 'merchant-4')
    ).rejects.toEqual({ message: 'merchant query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog cache identifiers:',
      expect.objectContaining({
        merchantId: 'merchant-4',
        error: { message: 'merchant query failed' },
      })
    );
  });

  it('throws when domain lookup errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = createSupabaseMock({
      merchant: { slug: 'test-store' },
      domainsError: { message: 'domain query failed' },
    });

    await expect(
      getMerchantBlogRevalidationContext(supabase.client, 'merchant-5')
    ).rejects.toEqual({ message: 'domain query failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch merchant blog domain identifiers:',
      expect.objectContaining({
        merchantId: 'merchant-5',
        error: { message: 'domain query failed' },
      })
    );
  });
});
