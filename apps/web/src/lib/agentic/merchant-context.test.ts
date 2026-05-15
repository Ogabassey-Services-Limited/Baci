// @vitest-environment node

import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// server-only has no runtime exports; mock it so Vitest can import server modules.
vi.mock('server-only', () => ({}));

function createMerchantLookupMock(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    eq,
    from,
    select,
    supabase: { from },
  };
}

function createMerchantWithFeatureSettingsLookupMock({
  featureSettings,
  featureSettingsError = null,
  merchant,
}: {
  featureSettings: unknown;
  featureSettingsError?: unknown;
  merchant: unknown;
}) {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: merchant,
    error: null,
  });
  const merchantEq = vi.fn(() => ({ maybeSingle: merchantMaybeSingle }));
  const merchantSelect = vi.fn(() => ({ eq: merchantEq }));
  const settingsMaybeSingle = vi.fn().mockResolvedValue({
    data: featureSettings,
    error: featureSettingsError,
  });
  const settingsEq = vi.fn(() => ({ maybeSingle: settingsMaybeSingle }));
  const settingsSelect = vi.fn(() => ({ eq: settingsEq }));
  const from = vi.fn((table: string) => {
    if (table === 'merchants') return { select: merchantSelect };
    if (table === 'merchant_feature_settings') {
      return { select: settingsSelect };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    from,
    merchantEq,
    merchantSelect,
    settingsEq,
    settingsSelect,
    supabase: { from },
  };
}

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
}

function createValidAgenticPrivateJwk() {
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  return JSON.stringify({
    ...privateKey.export({ format: 'jwk' }),
    alg: 'ES256',
    kid: 'agentic-test-key',
  });
}

function createInvalidAgenticJwk(): string {
  return JSON.stringify({
    alg: 'ES256',
    crv: 'P-256',
    d: 'not-importable',
    kid: 'agentic-test-key',
    kty: 'EC',
    x: 'not-importable',
    y: 'not-importable',
  });
}

function stubCompleteAgenticRuntimeEnv() {
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'confirmation-key');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', 'signing-key');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-secret');
  vi.stubEnv(
    'SUPABASE_AGENTIC_JWT_PRIVATE_JWK',
    createValidAgenticPrivateJwk()
  );
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
    expect(mock.from).toHaveBeenCalledWith('merchants');
    expect(mock.select).not.toHaveBeenCalledWith(
      expect.stringContaining('custom_domain')
    );
    expect(mock.eq).toHaveBeenCalledWith('slug', 'demo-store');
    expect(getConfiguredAgenticMerchantSlug()).toBe('demo-store');
  });

  it('includes agentic checkout and pay-on-delivery controls in the merchant context', async () => {
    stubBaseEnv();
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
    const { resolveAgenticMerchantContext } = await loadMerchantContextModule();
    const mock = createMerchantWithFeatureSettingsLookupMock({
      featureSettings: {
        agentic_checkout_enabled: false,
        custom_settings: {
          agentic_agent_allowlist: ['openai-agent'],
          agentic_agent_denylist: ['blocked-agent'],
        },
        pay_on_delivery_enabled: true,
      },
      merchant: {
        business_name: 'Demo Store',
        id: 'merchant-2',
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'demo-store',
      },
    });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context?.agentic_checkout_enabled).toBe(false);
    expect(context?.agent_user_agent_allowlist).toEqual(['openai-agent']);
    expect(context?.agent_user_agent_denylist).toEqual(['blocked-agent']);
    expect(context?.pay_on_delivery_enabled).toBe(true);
    expect(mock.settingsEq).toHaveBeenCalledWith('merchant_id', 'merchant-2');
  });

  it('fails closed for agentic checkout when feature settings cannot be read', async () => {
    stubBaseEnv();
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
    const { resolveAgenticMerchantContext } = await loadMerchantContextModule();
    const mock = createMerchantWithFeatureSettingsLookupMock({
      featureSettings: null,
      featureSettingsError: { message: 'settings unavailable' },
      merchant: {
        business_name: 'Demo Store',
        id: 'merchant-2',
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'demo-store',
      },
    });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context?.id).toBe('merchant-2');
    expect(context?.agentic_checkout_enabled).toBe(false);
    expect(context?.pay_on_delivery_enabled).toBe(false);
  });

  it('defaults agentic checkout to enabled when the feature settings row is missing', async () => {
    stubBaseEnv();
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'demo-store');
    const { resolveAgenticMerchantContext } = await loadMerchantContextModule();
    const mock = createMerchantWithFeatureSettingsLookupMock({
      featureSettings: null,
      merchant: {
        business_name: 'Demo Store',
        id: 'merchant-2',
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'demo-store',
      },
    });

    const context = await resolveAgenticMerchantContext(mock.supabase as never);

    expect(context?.agentic_checkout_enabled).toBe(true);
    expect(context?.pay_on_delivery_enabled).toBe(false);
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
    'SUPABASE_AGENTIC_JWT_PRIVATE_JWK',
  ])('does not advertise checkout when %s is missing', async (envKey) => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    vi.stubEnv(envKey, '');
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(false);
  });

  it('does not require Paystack configuration for the common agentic runtime', async () => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(true);
  });

  it('advertises checkout when an invalid configured JWK can fall back to the legacy JWT secret', async () => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', createInvalidAgenticJwk());
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-secret');
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(true);
  });

  it('does not advertise checkout when the configured JWK cannot be imported and no legacy JWT secret exists', async () => {
    stubBaseEnv();
    stubCompleteAgenticRuntimeEnv();
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', createInvalidAgenticJwk());
    delete process.env.SUPABASE_JWT_SECRET;
    const { isAgenticCheckoutRuntimeConfigured } =
      await loadMerchantContextModule();

    expect(isAgenticCheckoutRuntimeConfigured()).toBe(false);
  });
});
