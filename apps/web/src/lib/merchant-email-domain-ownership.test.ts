import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockVerifyDomain } = vi.hoisted(() => ({ mockVerifyDomain: vi.fn() }));
vi.mock('@/lib/vercel', () => ({
  vercel: { verifyDomain: mockVerifyDomain },
}));

import { assertMerchantOwnsVerifiedStorefrontDomain } from './merchant-email-domain-ownership';

/**
 * Chainable Supabase query stub that records `.eq()` filters. The query in
 * assertMerchantOwnsVerifiedStorefrontDomain terminates on `.in('domain_type',
 * …)`, so that call resolves to the result (no thenable builder needed).
 */
function stubDomains(result: { data: unknown; error: unknown }) {
  const eqCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return builder;
  });
  builder.in = vi.fn(() => Promise.resolve(result));
  const supabase = { from: vi.fn(() => builder) } as never;
  return { supabase, eqCalls };
}

describe('assertMerchantOwnsVerifiedStorefrontDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes for an exact active domain that verifies on Vercel', async () => {
    const { supabase, eqCalls } = stubDomains({
      data: [{ id: 'd1', domain: 'ogabassey.com' }],
      error: null,
    });
    mockVerifyDomain.mockResolvedValue({ verified: true, verification: [] });

    await expect(
      assertMerchantOwnsVerifiedStorefrontDomain(
        supabase,
        'm1',
        'Ogabassey.com'
      )
    ).resolves.toBeUndefined();

    // Scopes to the EXACT (lowercased) domain — never a www↔apex counterpart.
    expect(eqCalls).toContainEqual(['domain', 'ogabassey.com']);
    expect(mockVerifyDomain).toHaveBeenCalledWith('ogabassey.com');
  });

  it('throws when no active storefront row exists', async () => {
    const { supabase } = stubDomains({ data: [], error: null });

    await expect(
      assertMerchantOwnsVerifiedStorefrontDomain(
        supabase,
        'm1',
        'ogabassey.com'
      )
    ).rejects.toThrow('active verified storefront domain');
    expect(mockVerifyDomain).not.toHaveBeenCalled();
  });

  it('throws when the row exists but Vercel does not verify it', async () => {
    const { supabase } = stubDomains({
      data: [{ id: 'd1', domain: 'ogabassey.com' }],
      error: null,
    });
    mockVerifyDomain.mockResolvedValue({
      verified: false,
      verification: [{ type: 'TXT' }],
    });

    await expect(
      assertMerchantOwnsVerifiedStorefrontDomain(
        supabase,
        'm1',
        'ogabassey.com'
      )
    ).rejects.toThrow('active verified storefront domain');
  });

  it('fails closed when the Vercel call throws', async () => {
    const { supabase } = stubDomains({
      data: [{ id: 'd1', domain: 'ogabassey.com' }],
      error: null,
    });
    mockVerifyDomain.mockRejectedValue(new Error('vercel down'));

    await expect(
      assertMerchantOwnsVerifiedStorefrontDomain(
        supabase,
        'm1',
        'ogabassey.com'
      )
    ).rejects.toThrow('active verified storefront domain');
  });

  it('throws when the domains lookup errors', async () => {
    const { supabase } = stubDomains({
      data: null,
      error: { message: 'db down' },
    });

    await expect(
      assertMerchantOwnsVerifiedStorefrontDomain(
        supabase,
        'm1',
        'ogabassey.com'
      )
    ).rejects.toThrow('Failed to load storefront domain: db down');
  });
});
