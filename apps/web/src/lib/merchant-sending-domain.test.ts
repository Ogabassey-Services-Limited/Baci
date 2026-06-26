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
function stubQuery(result: { data: unknown; error: unknown }) {
  const eqCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  mockFrom.mockReturnValue(builder);
  return { eqCalls };
}

describe('getActiveMerchantSendingDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the domain for a verified, enabled merchant', async () => {
    const { eqCalls } = stubQuery({
      data: { domain: 'ogabassey.com' },
      error: null,
    });

    const domain = await getActiveMerchantSendingDomain('merchant-1');

    expect(domain).toBe('ogabassey.com');
    expect(mockFrom).toHaveBeenCalledWith('merchant_email_domains');
    expect(eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['status', 'verified'],
      ['enabled', true],
    ]);
  });

  it('returns null when no verified+enabled row exists', async () => {
    stubQuery({ data: null, error: null });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('returns null without querying when merchantId is missing', async () => {
    expect(await getActiveMerchantSendingDomain(null)).toBeNull();
    expect(await getActiveMerchantSendingDomain(undefined)).toBeNull();
    expect(await getActiveMerchantSendingDomain('')).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fails open (returns null) on a query error', async () => {
    stubQuery({ data: null, error: { message: 'boom' } });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });

  it('fails open (returns null) when the client throws', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('no service role key');
    });

    expect(await getActiveMerchantSendingDomain('merchant-1')).toBeNull();
  });
});
