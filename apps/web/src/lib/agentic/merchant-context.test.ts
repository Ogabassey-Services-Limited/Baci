import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getConfiguredAgenticMerchantSlug,
  resolveAgenticMerchantContext,
} from '@/lib/agentic/merchant-context';

function createMerchantLookupMock(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    eq,
    from,
    supabase: { from },
  };
}

describe('resolveAgenticMerchantContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the default Ogabassey merchant context', async () => {
    const mock = createMerchantLookupMock({
      business_name: 'Ogabassey',
      id: 'merchant-1',
      paystack_subaccount_code: 'ACCT_test123',
      slug: 'ogabassey',
    });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context).toEqual({
      business_name: 'Ogabassey',
      custom_domain: undefined,
      id: 'merchant-1',
      paystack_subaccount_code: 'ACCT_test123',
      slug: 'ogabassey',
    });
    expect(mock.eq).toHaveBeenCalledWith('slug', 'ogabassey');
  });

  it('uses the configured agentic merchant slug when present', async () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
    const mock = createMerchantLookupMock({
      business_name: 'Demo Store',
      id: 'merchant-2',
      paystack_subaccount_code: null,
      slug: 'demo-store',
    });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context?.id).toBe('merchant-2');
    expect(mock.eq).toHaveBeenCalledWith('slug', 'demo-store');
    expect(getConfiguredAgenticMerchantSlug()).toBe('demo-store');
  });

  it('returns null when the configured merchant cannot be resolved', async () => {
    const mock = createMerchantLookupMock(null, { message: 'not found' });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context).toBeNull();
  });
});
