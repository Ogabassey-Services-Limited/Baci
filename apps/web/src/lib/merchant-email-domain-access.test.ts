import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetMerchant } = vi.hoisted(() => ({ mockGetMerchant: vi.fn() }));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchant,
}));

import {
  emailDomainGate,
  resolveMerchantForEmailDomain,
} from './merchant-email-domain-access';

function supabaseStub(
  user: { id: string } | null,
  merchantResult: { data: unknown; error?: unknown } | unknown
) {
  const result =
    merchantResult &&
    typeof merchantResult === 'object' &&
    'data' in merchantResult
      ? merchantResult
      : { data: merchantResult, error: null };

  return {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve(result) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('resolveMerchantForEmailDomain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s when there is no user', async () => {
    const result = await resolveMerchantForEmailDomain(
      supabaseStub(null, null)
    );
    expect('error' in result && result.error.status).toBe(401);
  });

  it('403s when no merchant context resolves', async () => {
    mockGetMerchant.mockResolvedValue(null);
    const result = await resolveMerchantForEmailDomain(
      supabaseStub({ id: 'u1' }, null)
    );
    expect('error' in result && result.error.status).toBe(403);
  });

  it('500s when the authoritative merchant row lookup fails', async () => {
    mockGetMerchant.mockResolvedValue({
      merchantId: 'm1',
      merchantSlug: 'fb',
      staffAccess: { isOwner: true },
    });
    const result = await resolveMerchantForEmailDomain(
      supabaseStub(
        { id: 'u1' },
        { data: null, error: { message: 'database unavailable' } }
      )
    );
    expect('error' in result && result.error.status).toBe(500);
  });

  it('403s when the user is only a staff member', async () => {
    mockGetMerchant.mockResolvedValue({
      merchantId: 'm1',
      merchantSlug: 'fb',
      staffAccess: { isOwner: false },
    });
    const result = await resolveMerchantForEmailDomain(
      supabaseStub({ id: 'u1' }, { plan_tier: 'pro', slug: 'mystore' })
    );
    expect('error' in result && result.error.status).toBe(403);
  });

  it('resolves merchant id, plan tier and slug', async () => {
    mockGetMerchant.mockResolvedValue({
      merchantId: 'm1',
      merchantSlug: 'fb',
      staffAccess: { isOwner: true },
    });
    const result = await resolveMerchantForEmailDomain(
      supabaseStub({ id: 'u1' }, { plan_tier: 'pro', slug: 'mystore' })
    );
    expect(result).toEqual({
      merchantId: 'm1',
      planTier: 'pro',
      slug: 'mystore',
    });
  });
});

describe('emailDomainGate', () => {
  it('returns null for an entitled (pro) plan', () => {
    expect(
      emailDomainGate({ merchantId: 'm1', planTier: 'pro', slug: 's' })
    ).toBeNull();
  });

  it('returns 403 when plan tier is absent even for legacy negotiation slugs', () => {
    const res = emailDomainGate({
      merchantId: 'm1',
      planTier: null,
      slug: 'ogabassey',
    });
    expect(res?.status).toBe(403);
  });

  it('returns 403 for a free plan', () => {
    const res = emailDomainGate({
      merchantId: 'm1',
      planTier: 'free',
      slug: 's',
    });
    expect(res?.status).toBe(403);
  });
});
