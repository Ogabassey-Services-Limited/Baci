// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

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

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
}

function stubCompleteAgenticRuntimeEnv() {
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'confirmation-key');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', 'signing-key');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-secret');
}

function loadMerchantContextModule() {
  vi.resetModules();
  return import('@/lib/agentic/merchant-context');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('resolveAgenticMerchantContext', () => {
  it('returns null when no agentic merchant slug is configured', async () => {
    stubBaseEnv();
    const { resolveAgenticMerchantContext } = await loadMerchantContextModule();
    const mock = createMerchantLookupMock(null);

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('uses the configured agentic merchant slug when present', async () => {
    stubBaseEnv();
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
    const { getConfiguredAgenticMerchantSlug, resolveAgenticMerchantContext } =
      await loadMerchantContextModule();
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
    stubBaseEnv();
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'missing-store');
    const { resolveAgenticMerchantContext } = await loadMerchantContextModule();
    const mock = createMerchantLookupMock(null, { message: 'not found' });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context).toBeNull();
  });
});

describe('isAgenticCheckoutRuntimeConfigured', () => {
  it('requires all runtime checkout secrets before advertising checkout', async () => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(true);
  });

  it.each([
    'OPENAI_AGENTIC_MERCHANT_SLUG',
    'OPENAI_AGENTIC_API_KEY',
    'OPENAI_AGENTIC_CONFIRMATION_KEY',
    'OPENAI_AGENTIC_SIGNING_KEY',
    'PAYSTACK_SECRET_KEY',
  ])('does not advertise checkout when %s is missing', async (envKey) => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    vi.stubEnv(envKey, '');
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(false);
  });
});
