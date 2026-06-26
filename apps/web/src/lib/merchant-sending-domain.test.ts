import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { getActiveMerchantSendingDomain } from './merchant-sending-domain';

/**
 * Build a chainable query stub that resolves `.maybeSingle()` to the given
 * result, and records the `.eq()` filters that were applied.
 */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const eqCalls: [string, unknown][] = [];
  const inCalls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      inCalls.push([column, values]);
      return builder;
    }),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return { builder, eqCalls, inCalls };
}

function stubQueries({
  sendingDomain = {
    data: { domain: 'ogabassey.com', merchants: { plan_tier: 'pro' } },
    error: null,
  },
  activeDomain = { data: [{ id: 'domain-1' }], error: null },
}: {
  sendingDomain?: { data: unknown; error: unknown };
  activeDomain?: { data: unknown; error: unknown };
} = {}) {
  const sendingDomainQuery = makeBuilder(sendingDomain);
  const activeDomainQuery = makeBuilder(activeDomain);
  mockFrom.mockImplementation((table: string) => {
    if (table === 'merchant_email_domains') {
      return sendingDomainQuery.builder;
    }
    if (table === 'domains') {
      return activeDomainQuery.builder;
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { activeDomainQuery, sendingDomainQuery };
}

describe('getActiveMerchantSendingDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the domain for a verified, enabled, entitled merchant', async () => {
    const { activeDomainQuery, sendingDomainQuery } = stubQueries({
      sendingDomain: {
        data: { domain: 'ogabassey.com', merchants: { plan_tier: 'pro' } },
        error: null,
      },
    });

    const domain = await getActiveMerchantSendingDomain('merchant-1');

    expect(domain).toBe('ogabassey.com');
    expect(mockFrom).toHaveBeenCalledWith('merchant_email_domains');
    expect(mockFrom).toHaveBeenCalledWith('domains');
    expect(sendingDomainQuery.eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['status', 'verified'],
      ['enabled', true],
    ]);
    expect(activeDomainQuery.eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['status', 'active'],
    ]);
    expect(activeDomainQuery.inCalls).toEqual([
      ['domain', ['ogabassey.com', 'www.ogabassey.com']],
    ]);
  });

  it('handles the joined merchant returned as an array', async () => {
    stubQueries({
      sendingDomain: {
        data: {
          domain: 'ogabassey.com',
          merchants: [{ plan_tier: 'business' }],
        },
        error: null,
      },
    });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBe(
      'ogabassey.com'
    );
  });

  it('returns null when the merchant plan no longer carries the entitlement', async () => {
    stubQueries({
      sendingDomain: {
        data: { domain: 'ogabassey.com', merchants: { plan_tier: 'free' } },
        error: null,
      },
    });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('returns null when no verified+enabled row exists', async () => {
    stubQueries({ sendingDomain: { data: null, error: null } });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('returns null when the saved sender domain is no longer an active storefront domain', async () => {
    stubQueries({ activeDomain: { data: [], error: null } });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('returns null when active storefront-domain ownership lookup fails', async () => {
    stubQueries({
      activeDomain: { data: null, error: { message: 'domains unavailable' } },
    });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('returns null without querying when merchantId is missing', async () => {
    expect(await getActiveMerchantSendingDomain(null)).toBeNull();
    expect(await getActiveMerchantSendingDomain(undefined)).toBeNull();
    expect(await getActiveMerchantSendingDomain('')).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fails open (returns null) on a query error', async () => {
    stubQueries({ sendingDomain: { data: null, error: { message: 'boom' } } });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('fails open (returns null) when the client throws', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('no service role key');
    });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });
});
