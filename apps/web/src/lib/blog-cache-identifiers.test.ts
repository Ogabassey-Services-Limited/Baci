import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantBlogCacheIdentifiers,
  getMerchantBlogPostSlugs,
} from '@/lib/blog-cache-identifiers';

function createSupabaseMock(options: {
  domains?: Array<{ domain: string | null }> | null;
  domainsError?: { message: string } | null;
  merchant?: { slug?: string | null } | null;
  merchantError?: { message: string } | null;
  posts?: Array<{ slug: string | null }> | null;
  postsError?: { message: string } | null;
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

  const postsEq = vi.fn().mockResolvedValue({
    data: options.posts ?? null,
    error: options.postsError ?? null,
  });
  const postsSelect = vi.fn().mockReturnValue({
    eq: postsEq,
  });

  const from = vi.fn((table: string) => {
    if (table === 'merchants') {
      return { select: merchantSelect };
    }

    if (table === 'domains') {
      return { select: domainsSelect };
    }

    if (table === 'blog_posts') {
      return { select: postsSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient,
    domainsEq,
    domainsIn,
    from,
    merchantEq,
    merchantMaybeSingle,
    postsEq,
  };
}

describe('blog cache identifier helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMerchantBlogCacheIdentifiers', () => {
    it('returns the merchant slug and active custom domains', async () => {
      const supabase = createSupabaseMock({
        merchant: { slug: 'Test-Store' },
        domains: [
          { domain: 'ogabassey.com' },
          { domain: 'WWW.OGABASSEY.COM' },
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

    it('returns an empty array when the merchant lookup errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const supabase = createSupabaseMock({
        merchantError: { message: 'merchant query failed' },
      });

      await expect(
        getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-3')
      ).resolves.toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch merchant blog cache identifiers:',
        expect.objectContaining({
          merchantId: 'merchant-3',
          error: { message: 'merchant query failed' },
        })
      );
    });

    it('logs and falls back to the merchant slug when the domain lookup fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const supabase = createSupabaseMock({
        merchant: { slug: 'test-store' },
        domainsError: { message: 'domain query failed' },
      });

      await expect(
        getMerchantBlogCacheIdentifiers(supabase.client, 'merchant-4')
      ).resolves.toEqual(['test-store']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch merchant blog domain identifiers:',
        expect.objectContaining({
          merchantId: 'merchant-4',
          error: { message: 'domain query failed' },
        })
      );
    });
  });

  describe('getMerchantBlogPostSlugs', () => {
    it('returns unique normalized post slugs', async () => {
      const supabase = createSupabaseMock({
        posts: [
          { slug: 'apple-studio-display-review' },
          { slug: 'Apple-Studio-Display-Review' },
          { slug: null },
        ],
      });

      await expect(
        getMerchantBlogPostSlugs(supabase.client, 'merchant-5')
      ).resolves.toEqual(['apple-studio-display-review']);
      expect(supabase.postsEq).toHaveBeenCalledWith(
        'merchant_id',
        'merchant-5'
      );
    });

    it('logs and returns an empty array when the posts lookup fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const supabase = createSupabaseMock({
        postsError: { message: 'posts query failed' },
      });

      await expect(
        getMerchantBlogPostSlugs(supabase.client, 'merchant-6')
      ).resolves.toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch merchant blog post slugs:',
        expect.objectContaining({
          merchantId: 'merchant-6',
          error: { message: 'posts query failed' },
        })
      );
    });
  });
});
