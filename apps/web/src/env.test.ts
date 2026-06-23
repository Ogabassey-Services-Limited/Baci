// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('GITHUB_ACTIONS', 'false');
  vi.stubEnv('GITHUB_REPOSITORY', '');
  vi.stubEnv('GITHUB_RUN_ID', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;
  delete process.env.BACI_WORKER_PROFILE;
}

function loadEnvModule() {
  vi.resetModules();
  return import('@/env');
}

const validAgenticPrivateJwk = JSON.stringify({
  alg: 'ES256',
  crv: 'P-256',
  d: 'private-key-material',
  kid: 'agentic-test-key',
  kty: 'EC',
  x: 'public-x-coordinate',
  y: 'public-y-coordinate',
});

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rejects production boot when Supabase JWT signing material is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GITHUB_ACTIONS', 'false');
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;

    await expect(loadEnvModule()).rejects.toThrow(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK'
    );
  }, 60_000);

  it('treats whitespace-only Supabase JWT signing material as missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GITHUB_ACTIONS', 'false');
    vi.stubEnv('SUPABASE_JWT_SECRET', '   ');
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', '   ');

    await expect(loadEnvModule()).rejects.toThrow(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK or SUPABASE_JWT_SECRET is required in production'
    );
  });

  it('allows GitHub Actions production builds without runtime signing material', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('GITHUB_REPOSITORY', 'ogabasseyy/Baci');
    vi.stubEnv('GITHUB_RUN_ID', '123');
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('allows the AI storefront worker profile without agentic signing material', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GITHUB_ACTIONS', 'false');
    vi.stubEnv('BACI_WORKER_PROFILE', 'ai-storefront-jobs');
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('rejects spoofed GitHub Actions builds without GitHub run context', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('GITHUB_REPOSITORY', '');
    vi.stubEnv('GITHUB_RUN_ID', '');
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;

    await expect(loadEnvModule()).rejects.toThrow(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK or SUPABASE_JWT_SECRET is required in production'
    );
  });

  it('allows production boot when an agentic JWT signing key is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', validAgenticPrivateJwk);

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('ignores a whitespace-only legacy JWT secret when an agentic signing key is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', '   ');
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', validAgenticPrivateJwk);

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('accepts common truthy values for Google Pay enablement', async () => {
    vi.stubEnv('BACI_GOOGLE_PAY_ENABLED', 'yes');
    vi.stubEnv('BACI_GOOGLE_PAY_GATEWAY', 'paystack');
    vi.stubEnv('BACI_GOOGLE_PAY_GATEWAY_MERCHANT_ID', 'merchant-gateway');
    vi.stubEnv('BACI_GOOGLE_PAY_MERCHANT_ID', 'merchant-google-pay');

    const { getGooglePayAgenticConfig } = await loadEnvModule();

    expect(getGooglePayAgenticConfig()).toEqual({
      gateway: 'paystack',
      gatewayMerchantId: 'merchant-gateway',
      merchantId: 'merchant-google-pay',
    });
  });

  it('rejects production boot when the agentic JWT signing key is malformed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK',
      '{"alg":"ES256","kid":"agentic-test-key"}'
    );

    await expect(loadEnvModule()).rejects.toThrow(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK must be an ES256 private EC JWK with kid'
    );
  });

  it('rejects server boot when the service role key is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(loadEnvModule()).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('loads AI storefront Ollama env through the central schema', async () => {
    vi.stubEnv('OLLAMA_STOREFRONT_BASE_URL', 'http://127.0.0.1:11434');
    vi.stubEnv('OLLAMA_STOREFRONT_MODEL', '  gemma4:\ne2b  ');
    vi.stubEnv('OLLAMA_STOREFRONT_TIMEOUT_MS', '300000');

    const {
      getOllamaStorefrontBaseUrl,
      getOllamaStorefrontModel,
      getOllamaStorefrontTimeoutMs,
    } = await loadEnvModule();

    expect(getOllamaStorefrontBaseUrl()).toBe('http://127.0.0.1:11434');
    expect(getOllamaStorefrontModel()).toBe('gemma4:e2b');
    expect(getOllamaStorefrontTimeoutMs()).toBe(300_000);
  });

  it('returns undefined when no AI storefront Ollama URL is configured', async () => {
    const { getOllamaStorefrontBaseUrl } = await loadEnvModule();

    expect(getOllamaStorefrontBaseUrl()).toBeUndefined();
  });

  it('rejects invalid AI storefront Ollama URLs in production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACI_WORKER_PROFILE', 'ai-storefront-jobs');
    vi.stubEnv('OLLAMA_STOREFRONT_BASE_URL', 'http://example.com:11434');

    await expect(loadEnvModule()).rejects.toThrow('OLLAMA_STOREFRONT_BASE_URL');
  });

  it('rejects blank AI storefront model names at runtime', async () => {
    vi.stubEnv('OLLAMA_STOREFRONT_MODEL', '   ');
    const { getOllamaStorefrontModel } = await loadEnvModule();

    expect(() => getOllamaStorefrontModel()).toThrow(
      'OLLAMA_STOREFRONT_MODEL must resolve to a non-empty model name'
    );
  });

  it.each([
    'abc',
    '-1',
  ])('rejects invalid AI storefront timeouts in production: %s', async (value) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACI_WORKER_PROFILE', 'ai-storefront-jobs');
    vi.stubEnv('OLLAMA_STOREFRONT_TIMEOUT_MS', value);

    await expect(loadEnvModule()).rejects.toThrow(
      'OLLAMA_STOREFRONT_TIMEOUT_MS'
    );
  });

  it('loads server env when required production secrets are present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-test-secret');

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('normalizes blank mobile release env values instead of exposing them', async () => {
    vi.stubEnv('APP_STORE_CONNECT_BUNDLE_ID', '   ');
    vi.stubEnv('APP_STORE_CONNECT_ADMIN_BUNDLE_ID', '   ');
    vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', '   ');
    vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', '   ');
    vi.stubEnv('GOOGLE_PLAY_ADMIN_PACKAGE_NAME', '   ');
    vi.stubEnv('APP_STORE_CONNECT_WEBHOOK_SECRET', '   ');
    vi.stubEnv('APP_STORE_CONNECT_ADMIN_WEBHOOK_SECRET', '   ');

    const {
      getAppStoreConnectBundleId,
      getAppStoreConnectWebhookSecret,
      getGooglePlayPackageName,
      getGooglePlayServiceAccountJson,
    } = await loadEnvModule();

    expect(getAppStoreConnectBundleId('storefront')).toBe('com.ogabassey.app');
    expect(getAppStoreConnectBundleId('admin')).toBe('com.ogabassey.baci');
    expect(getGooglePlayPackageName('storefront')).toBe('com.ogabassey.store');
    expect(getGooglePlayPackageName('admin')).toBe('com.ogabassey.baci');
    expect(getGooglePlayServiceAccountJson()).toBeUndefined();
    expect(getAppStoreConnectWebhookSecret('storefront')).toBeUndefined();
    expect(getAppStoreConnectWebhookSecret('admin')).toBeUndefined();
  });

  it('trims configured mobile release env values', async () => {
    vi.stubEnv('APP_STORE_CONNECT_BUNDLE_ID', ' com.example.storefront ');
    vi.stubEnv('APP_STORE_CONNECT_ADMIN_BUNDLE_ID', ' com.example.admin ');
    vi.stubEnv(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
      ' {"client_email":"bot@example.com"} '
    );
    vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', ' com.example.store ');
    vi.stubEnv('GOOGLE_PLAY_ADMIN_PACKAGE_NAME', ' com.example.baci ');
    vi.stubEnv('APP_STORE_CONNECT_WEBHOOK_SECRET', ' storefront-secret ');
    vi.stubEnv('APP_STORE_CONNECT_ADMIN_WEBHOOK_SECRET', ' admin-secret ');

    const {
      getAppStoreConnectBundleId,
      getAppStoreConnectWebhookSecret,
      getGooglePlayPackageName,
      getGooglePlayServiceAccountJson,
    } = await loadEnvModule();

    expect(getAppStoreConnectBundleId('storefront')).toBe(
      'com.example.storefront'
    );
    expect(getAppStoreConnectBundleId('admin')).toBe('com.example.admin');
    expect(getGooglePlayPackageName('storefront')).toBe('com.example.store');
    expect(getGooglePlayPackageName('admin')).toBe('com.example.baci');
    expect(getGooglePlayServiceAccountJson()).toBe(
      '{"client_email":"bot@example.com"}'
    );
    expect(getAppStoreConnectWebhookSecret('storefront')).toBe(
      'storefront-secret'
    );
    expect(getAppStoreConnectWebhookSecret('admin')).toBe('admin-secret');
  });

  it('defaults the terminal idempotency record window to 24 hours', async () => {
    const { getTerminalIdempotencyRecordWindowMs } = await loadEnvModule();

    expect(getTerminalIdempotencyRecordWindowMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('uses MYCOVER_SECRET_KEY as the MyCover webhook signing secret fallback', async () => {
    delete process.env.MYCOVER_WEBHOOK_SECRET;
    vi.stubEnv('MYCOVER_SECRET_KEY', '  MCASECK|secret  ');

    const { getMyCoverWebhookSecret } = await loadEnvModule();

    expect(getMyCoverWebhookSecret()).toBe('MCASECK|secret');
  });

  it('uses MYCOVER_SECRET_KEY when MYCOVER_WEBHOOK_SECRET is whitespace only', async () => {
    vi.stubEnv('MYCOVER_WEBHOOK_SECRET', '   ');
    vi.stubEnv('MYCOVER_SECRET_KEY', '  MCASECK|secret  ');

    const { getMyCoverWebhookSecret } = await loadEnvModule();

    expect(getMyCoverWebhookSecret()).toBe('MCASECK|secret');
  });

  it('allows overriding the terminal idempotency record window', async () => {
    vi.stubEnv('TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS', '3600000');
    const { getTerminalIdempotencyRecordWindowMs } = await loadEnvModule();

    expect(getTerminalIdempotencyRecordWindowMs()).toBe(3_600_000);
  });

  it('rejects invalid terminal idempotency record windows in production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-test-secret');
    vi.stubEnv('TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS', '0');

    await expect(loadEnvModule()).rejects.toThrow(
      'TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS'
    );
  });

  it('ignores a whitespace-only agentic signing key when a legacy JWT secret is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-test-secret');
    vi.stubEnv('SUPABASE_AGENTIC_JWT_PRIVATE_JWK', '   ');

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('loads client env without requiring server-only secrets', async () => {
    vi.stubGlobal('window', {});
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK;

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('trims agentic runtime secrets and filters blank rotations', async () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', '  agent-api-key  ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', '   ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', '  confirmation-key  ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '   ');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', '  signing-key  ');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', '   ');
    vi.stubEnv('PAYSTACK_SECRET_KEY', '  paystack-secret  ');
    vi.stubEnv(
      'SUPABASE_AGENTIC_JWT_PRIVATE_JWK',
      `  ${validAgenticPrivateJwk}  `
    );
    const {
      getAgenticApiKey,
      getAgenticApiKeys,
      getAgenticConfirmationKeys,
      getAgenticSigningKeys,
      getPaystackSecretKey,
      getSupabaseAgenticJwtPrivateJwk,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBe('agent-api-key');
    expect(getAgenticApiKeys()).toEqual(['agent-api-key']);
    expect(getAgenticConfirmationKeys()).toEqual(['confirmation-key']);
    expect(getAgenticSigningKeys()).toEqual(['signing-key']);
    expect(getPaystackSecretKey()).toBe('paystack-secret');
    expect(getSupabaseAgenticJwtPrivateJwk()).toBe(validAgenticPrivateJwk);
  });

  it('prefers Baci-owned agentic runtime secrets over legacy OpenAI-named aliases', async () => {
    vi.stubEnv('BACI_AGENTIC_ACCESS_TOKEN', ' baci-access ');
    vi.stubEnv('BACI_AGENTIC_ACCESS_TOKEN_PREVIOUS', ' baci-previous-access ');
    vi.stubEnv('BACI_AGENTIC_CONFIRMATION_KEY', ' baci-confirmation ');
    vi.stubEnv(
      'BACI_AGENTIC_CONFIRMATION_KEY_PREVIOUS',
      ' baci-previous-confirmation '
    );
    vi.stubEnv('BACI_AGENTIC_SIGNING_KEY', ' baci-signing ');
    vi.stubEnv('BACI_AGENTIC_SIGNING_KEY_PREVIOUS', ' baci-previous-signing ');
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', ' baci-store ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', ' legacy-access ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', ' legacy-previous-access ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', ' legacy-confirmation ');
    vi.stubEnv(
      'OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS',
      ' legacy-previous-confirmation '
    );
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', ' legacy-signing ');
    vi.stubEnv(
      'OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS',
      ' legacy-previous-signing '
    );
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', ' legacy-store ');
    const {
      getAgenticApiKey,
      getAgenticApiKeys,
      getAgenticConfirmationKeys,
      getAgenticMerchantSlug,
      getAgenticSigningKeys,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBe('baci-access');
    expect(getAgenticApiKeys()).toEqual([
      'baci-access',
      'baci-previous-access',
    ]);
    expect(getAgenticConfirmationKeys()).toEqual([
      'baci-confirmation',
      'baci-previous-confirmation',
    ]);
    expect(getAgenticSigningKeys()).toEqual([
      'baci-signing',
      'baci-previous-signing',
    ]);
    expect(getAgenticMerchantSlug()).toBe('baci-store');
  });

  it('falls back to legacy agentic aliases when Baci-owned aliases are blank', async () => {
    vi.stubEnv('BACI_AGENTIC_ACCESS_TOKEN', '   ');
    vi.stubEnv('BACI_AGENTIC_ACCESS_TOKEN_PREVIOUS', '   ');
    vi.stubEnv('BACI_AGENTIC_CONFIRMATION_KEY', '   ');
    vi.stubEnv('BACI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '   ');
    vi.stubEnv('BACI_AGENTIC_SIGNING_KEY', '   ');
    vi.stubEnv('BACI_AGENTIC_SIGNING_KEY_PREVIOUS', '   ');
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '   ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', ' legacy-access ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', ' legacy-previous-access ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', ' legacy-confirmation ');
    vi.stubEnv(
      'OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS',
      ' legacy-previous-confirmation '
    );
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', ' legacy-signing ');
    vi.stubEnv(
      'OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS',
      ' legacy-previous-signing '
    );
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', ' legacy-store ');
    const {
      getAgenticApiKey,
      getAgenticApiKeys,
      getAgenticConfirmationKeys,
      getAgenticMerchantSlug,
      getAgenticSigningKeys,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBe('legacy-access');
    expect(getAgenticApiKeys()).toEqual([
      'legacy-access',
      'legacy-previous-access',
    ]);
    expect(getAgenticConfirmationKeys()).toEqual([
      'legacy-confirmation',
      'legacy-previous-confirmation',
    ]);
    expect(getAgenticSigningKeys()).toEqual([
      'legacy-signing',
      'legacy-previous-signing',
    ]);
    expect(getAgenticMerchantSlug()).toBe('legacy-store');
  });

  it('treats empty agentic runtime secrets as unset', async () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', '');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', '');
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    const {
      getAgenticApiKey,
      getAgenticApiKeys,
      getAgenticConfirmationKeys,
      getAgenticSigningKeys,
      getPaystackSecretKey,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBeUndefined();
    expect(getAgenticApiKeys()).toEqual([]);
    expect(getAgenticConfirmationKeys()).toEqual([]);
    expect(getAgenticSigningKeys()).toEqual([]);
    expect(getPaystackSecretKey()).toBeUndefined();
  });

  it('does not expose a previous agentic API key without a current key', async () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', ' previous-api ');
    const { getAgenticApiKey, getAgenticApiKeys } = await loadEnvModule();

    expect(getAgenticApiKey()).toBeUndefined();
    expect(getAgenticApiKeys()).toEqual([]);
  });

  it('includes current and previous agentic rotation keys after trimming', async () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', ' current-api ');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY_PREVIOUS', ' previous-api ');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', ' current-confirmation ');
    vi.stubEnv(
      'OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS',
      ' previous-confirmation '
    );
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', ' current-signing ');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', ' previous-signing ');
    const {
      getAgenticApiKeys,
      getAgenticConfirmationKeys,
      getAgenticSigningKeys,
    } = await loadEnvModule();

    expect(getAgenticApiKeys()).toEqual(['current-api', 'previous-api']);
    expect(getAgenticConfirmationKeys()).toEqual([
      'current-confirmation',
      'previous-confirmation',
    ]);
    expect(getAgenticSigningKeys()).toEqual([
      'current-signing',
      'previous-signing',
    ]);
  });
});

describe('env model getters', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('sanitizes configured chat model names', async () => {
    vi.stubEnv('AI_CHAT_MODEL', 'gemma4:e4b\\n\n\r');
    const { getAiChatModel } = await loadEnvModule();

    expect(getAiChatModel()).toBe('gemma4:e4b');
  });

  it('defaults the chat provider to auto', async () => {
    delete process.env.AI_CHAT_PROVIDER;
    const { getAiChatProvider } = await loadEnvModule();

    expect(getAiChatProvider()).toBe('auto');
  });

  it('normalizes a configured chat provider', async () => {
    vi.stubEnv('AI_CHAT_PROVIDER', '  Gemini\\n\n  ');
    const { getAiChatProvider } = await loadEnvModule();

    expect(getAiChatProvider()).toBe('gemini');
  });

  it('rejects invalid chat providers in production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('AI_CHAT_PROVIDER', 'openai');

    await expect(loadEnvModule()).rejects.toThrow(/AI_CHAT_PROVIDER/);
  });

  it('rejects blank chat model names after sanitization', async () => {
    vi.stubEnv('AI_CHAT_MODEL', ' \\n\n\r ');
    const { getAiChatModel } = await loadEnvModule();

    expect(() => getAiChatModel()).toThrow(
      'AI_CHAT_MODEL must resolve to a non-empty model name'
    );
  });

  it('sanitizes configured CAC model names', async () => {
    vi.stubEnv('OLLAMA_CAC_MODEL', '  gemma4:e4b\\n\n\r ');
    const { getOllamaCacModel } = await loadEnvModule();

    expect(getOllamaCacModel()).toBe('gemma4:e4b');
  });

  it('rejects blank CAC model names after sanitization', async () => {
    vi.stubEnv('OLLAMA_CAC_MODEL', ' \\n\n\r ');
    const { getOllamaCacModel } = await loadEnvModule();

    expect(() => getOllamaCacModel()).toThrow(
      'OLLAMA_CAC_MODEL must resolve to a non-empty model name'
    );
  });

  it('defaults CAC verification endpoints to the current public APIs', async () => {
    const { getCacApiUrl, getCacTinApiBaseUrl } = await loadEnvModule();

    expect(getCacApiUrl()).toBe(
      'https://authapp.cac.gov.ng/name_similarity_app/api/public_search/search'
    );
    expect(getCacTinApiBaseUrl()).toBe(
      'https://icrp.cac.gov.ng/tin_service/api/v1/public/tin'
    );
  });
});

describe('env AI storefront trigger validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('accepts an HTTPS trigger URL with a bearer secret', async () => {
    vi.stubEnv(
      'AI_STOREFRONT_TRIGGER_URL',
      'https://workers.ogabassey.com/ai-storefront/trigger'
    );
    vi.stubEnv('AI_STOREFRONT_TRIGGER_SECRET', 'trigger-secret');
    vi.stubEnv('AI_STOREFRONT_TRIGGER_TIMEOUT_MS', '7000');

    const {
      getAiStorefrontWorkerTriggerSecret,
      getAiStorefrontWorkerTriggerTimeoutMs,
      getAiStorefrontWorkerTriggerUrl,
    } = await loadEnvModule();

    expect(getAiStorefrontWorkerTriggerUrl()).toBe(
      'https://workers.ogabassey.com/ai-storefront/trigger'
    );
    expect(getAiStorefrontWorkerTriggerSecret()).toBe('trigger-secret');
    expect(getAiStorefrontWorkerTriggerTimeoutMs()).toBe(7000);
  });

  it('fails boot when a trigger URL is configured without a secret', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv(
      'AI_STOREFRONT_TRIGGER_URL',
      'https://workers.ogabassey.com/ai-storefront/trigger'
    );
    delete process.env.AI_STOREFRONT_TRIGGER_SECRET;

    await expect(loadEnvModule()).rejects.toThrow(
      /AI_STOREFRONT_TRIGGER_SECRET/
    );
  });

  it('fails boot when a trigger URL is configured with a blank secret', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv(
      'AI_STOREFRONT_TRIGGER_URL',
      'https://workers.ogabassey.com/ai-storefront/trigger'
    );
    vi.stubEnv('AI_STOREFRONT_TRIGGER_SECRET', '   ');

    await expect(loadEnvModule()).rejects.toThrow(
      /AI_STOREFRONT_TRIGGER_SECRET/
    );
  });

  it('fails boot when a trigger secret is configured without a URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    delete process.env.AI_STOREFRONT_TRIGGER_URL;
    vi.stubEnv('AI_STOREFRONT_TRIGGER_SECRET', 'trigger-secret');

    await expect(loadEnvModule()).rejects.toThrow(/AI_STOREFRONT_TRIGGER_URL/);
  });
});

describe('env LLM server validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('accepts an HTTPS LLM_SERVER_URL with a bearer', async () => {
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', 'a'.repeat(64));

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBe('https://llm.example.com');
    expect(getLlmServerBearer()).toBe('a'.repeat(64));
  });

  it('accepts an http://localhost LLM_SERVER_URL for dev', async () => {
    vi.stubEnv('LLM_SERVER_URL', 'http://localhost:11500');
    vi.stubEnv('LLM_SERVER_BEARER', 'dev-token');

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBe('http://localhost:11500');
    expect(getLlmServerBearer()).toBe('dev-token');
  });

  it('accepts an http://127.0.0.1 LLM_SERVER_URL for dev', async () => {
    vi.stubEnv('LLM_SERVER_URL', 'http://127.0.0.1:11500');
    vi.stubEnv('LLM_SERVER_BEARER', 'dev-token');

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBe('http://127.0.0.1:11500');
    expect(getLlmServerBearer()).toBe('dev-token');
  });

  it('accepts an http://[::1] LLM_SERVER_URL for IPv6 loopback dev', async () => {
    // `new URL('http://[::1]:11500').hostname` returns the unbracketed form
    // '::1' in spec-compliant runtimes and '[::1]' in older ones. The schema's
    // localhost predicate accepts both.
    vi.stubEnv('LLM_SERVER_URL', 'http://[::1]:11500');
    vi.stubEnv('LLM_SERVER_BEARER', 'dev-token');

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBe('http://[::1]:11500');
    expect(getLlmServerBearer()).toBe('dev-token');
  });

  it('trims surrounding whitespace from LLM_SERVER_BEARER', async () => {
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', '   abcdef-bearer   ');

    const { getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerBearer()).toBe('abcdef-bearer');
  });

  it('rejects production boot with an http:// LLM_SERVER_URL pointing at a non-loopback host', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'http://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', 'a'.repeat(64));

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_URL/);
  });

  it('fails production boot when LLM_SERVER_URL is set but LLM_SERVER_BEARER is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    delete process.env.LLM_SERVER_BEARER;

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('fails production boot when LLM_SERVER_URL is set but LLM_SERVER_BEARER is empty string', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', '');

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('fails production boot when LLM_SERVER_BEARER is whitespace-only', async () => {
    // .trim() in the schema collapses "   " to "" before .min(1), so the
    // superRefine sees an undefined bearer and the boot fails closed —
    // rather than booting with a blank bearer that always falls back to
    // Gemini at runtime.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', '   ');

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('fails production boot when LLM_SERVER_BEARER contains control characters', async () => {
    // The schema reuses buildLlmBearerAuthHeader's validator, so invalid
    // tokens fail at boot instead of being rejected per-request and
    // silently routing to Gemini.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', 'token\nwith-newline');

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('fails production boot when LLM_SERVER_BEARER is "BearerXyz" (no separator)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', 'BearerXyz');

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('fails production boot when LLM_SERVER_BEARER exceeds 2048 chars', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('LLM_SERVER_URL', 'https://llm.example.com');
    vi.stubEnv('LLM_SERVER_BEARER', 'a'.repeat(2049));

    await expect(loadEnvModule()).rejects.toThrow(/LLM_SERVER_BEARER/);
  });

  it('accepts LLM_SERVER_BEARER set without LLM_SERVER_URL (orphan token is harmless)', async () => {
    // Policy: the schema does not require LLM_SERVER_URL to be set when
    // LLM_SERVER_BEARER is. The bearer is only consumed by the chat route
    // when LLM_SERVER_URL is also set, so an orphan bearer is dead code,
    // not a security issue. Documenting this so a future "must always pair"
    // change is intentional.
    delete process.env.LLM_SERVER_URL;
    vi.stubEnv('LLM_SERVER_BEARER', 'a'.repeat(64));

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBeUndefined();
    expect(getLlmServerBearer()).toBe('a'.repeat(64));
  });

  it('treats blank orphan LLM_SERVER_BEARER values as unset', async () => {
    delete process.env.LLM_SERVER_URL;
    vi.stubEnv('LLM_SERVER_BEARER', '   ');

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBeUndefined();
    expect(getLlmServerBearer()).toBeUndefined();
  });

  it('allows LLM_SERVER_BEARER to be unset when LLM_SERVER_URL is unset', async () => {
    delete process.env.LLM_SERVER_URL;
    delete process.env.LLM_SERVER_BEARER;

    const { getLlmServerUrl, getLlmServerBearer } = await loadEnvModule();
    expect(getLlmServerUrl()).toBeUndefined();
    expect(getLlmServerBearer()).toBeUndefined();
  });

  it('returns the VPS Gemma Ollama model id by default', async () => {
    delete process.env.LLM_CHAT_MODEL;
    const { getLlmChatModel } = await loadEnvModule();
    expect(getLlmChatModel()).toBe('gemma4:e4b');
  });

  it('honors a configured LLM_CHAT_MODEL after sanitization', async () => {
    vi.stubEnv('LLM_CHAT_MODEL', '  gemma4:e4b\\n\n\r ');
    const { getLlmChatModel } = await loadEnvModule();
    expect(getLlmChatModel()).toBe('gemma4:e4b');
  });

  it('rejects blank LLM_CHAT_MODEL after sanitization', async () => {
    vi.stubEnv('LLM_CHAT_MODEL', ' \\n\n\r ');
    const { getLlmChatModel } = await loadEnvModule();
    expect(() => getLlmChatModel()).toThrow(
      'LLM_CHAT_MODEL must resolve to a non-empty model name'
    );
  });
});

describe('env quiz validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('defaults QUIZ_PHASE to 1a and treats missing production approval as false', async () => {
    delete process.env.QUIZ_PHASE;
    delete process.env.QUIZ_PRODUCTION_APPROVED;

    const { env } = await loadEnvModule();

    expect(env.QUIZ_PHASE).toBe('1a');
    expect(env.QUIZ_PRODUCTION_APPROVED).toBe(false);
  });

  it('accepts production quiz phase and truthy production approval aliases', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'yes');
    vi.stubEnv('QUIZ_RPC_SERVER_SECRET', 'quiz-secret');

    const { env } = await loadEnvModule();

    expect(env.QUIZ_PHASE).toBe('production');
    expect(env.QUIZ_PRODUCTION_APPROVED).toBe(true);
  });

  it('requires QUIZ_RPC_SERVER_SECRET when QUIZ_PHASE is production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('QUIZ_PHASE', 'production');
    delete process.env.QUIZ_RPC_SERVER_SECRET;

    await expect(loadEnvModule()).rejects.toThrow(
      /QUIZ_RPC_SERVER_SECRET is required when QUIZ_PHASE is production/
    );
  });

  it('declares and trims quiz runtime secret configuration', async () => {
    vi.stubEnv('QUIZ_RPC_SERVER_SECRET', '  quiz-secret  ');
    vi.stubEnv(
      'QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON',
      '  {"ios":"strong"}  '
    );

    const { env } = await loadEnvModule();

    expect(env.QUIZ_RPC_SERVER_SECRET).toBe('quiz-secret');
    expect(env.QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON).toEqual({
      ios: 'strong',
    });
  });

  it('reads quiz runtime getters from current process env values', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'yes');
    vi.stubEnv('QUIZ_RPC_SERVER_SECRET', 'runtime-secret');

    const {
      getQuizIntegrityTierOverridesJson,
      getQuizPhaseEnv,
      getQuizProductionApprovedEnv,
      getQuizRpcServerSecret,
    } = await loadEnvModule();

    expect(getQuizPhaseEnv()).toBe('production');
    expect(getQuizProductionApprovedEnv()).toBe(true);

    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', '0');
    vi.stubEnv('QUIZ_RPC_SERVER_SECRET', '  runtime-secret  ');
    vi.stubEnv('QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON', ' {"ios":"strong"} ');

    expect(getQuizProductionApprovedEnv()).toBe(false);
    expect(getQuizRpcServerSecret()).toBe('runtime-secret');
    expect(getQuizIntegrityTierOverridesJson()).toEqual({ ios: 'strong' });
  });

  it('rejects malformed quiz integrity tier override JSON at boot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON', '{not-json');

    await expect(loadEnvModule()).rejects.toThrow(
      /QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON/
    );
  });

  it('rejects unsupported quiz integrity tier override values at runtime', async () => {
    const { getQuizIntegrityTierOverridesJson } = await loadEnvModule();

    vi.stubEnv('QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON', '{"ios":"turbo"}');

    expect(() => getQuizIntegrityTierOverridesJson()).toThrow(
      'QUIZ_APP_INTEGRITY_TIER_OVERRIDES_JSON must be a JSON object with basic, device, or strong values'
    );
  });

  it('rejects invalid QUIZ_PRODUCTION_APPROVED runtime values', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'maybe');

    const { getQuizProductionApprovedEnv } = await loadEnvModule();

    expect(() => getQuizProductionApprovedEnv()).toThrow(
      'QUIZ_PRODUCTION_APPROVED must be one of true/false/1/0/yes/no'
    );
  });

  it('rejects invalid QUIZ_PHASE values at boot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'jwt-secret');
    vi.stubEnv('QUIZ_PHASE', 'staging');

    await expect(loadEnvModule()).rejects.toThrow(/QUIZ_PHASE/);
  });
});

describe('isAllowedLlmServerUrl', () => {
  // Pure unit tests against the exported helper — no env stubbing needed.
  // Covers the codex P1 (loose 127.* prefix) and P2 (any-scheme loopback)
  // findings on PR #1552.
  const accepted: ReadonlyArray<readonly [string, string]> = [
    ['https public host', 'https://api.example.com/v1'],
    ['http localhost', 'http://localhost:11500'],
    ['http localhost (uppercase)', 'http://LOCALHOST:11500'],
    ['http 127.0.0.1', 'http://127.0.0.1:11500'],
    ['http 127.x.y.z within /8', 'http://127.255.255.254:8080'],
    [
      'https on loopback (tighter than http-loopback)',
      'https://127.0.0.1:11500',
    ],
    // `new URL('http://[::1]:11500').hostname === '::1'` in Node ≥18.
    ['http IPv6 loopback', 'http://[::1]:11500'],
  ];

  const rejected: ReadonlyArray<readonly [string, string]> = [
    ['http on non-loopback host', 'http://example.com'],
    // P1 — the actual regression: prefix match let arbitrary remote hosts
    // bypass the HTTPS requirement just by starting with "127.".
    [
      'http 127.example.com (loose-match exploit)',
      'http://127.example.com:11500',
    ],
    [
      'http 127malicious (no dot — not a 127.x.y.z literal)',
      'http://127malicious',
    ],
    [
      'http 127.0.0.1.evil.com (loopback prefix on attacker host)',
      'http://127.0.0.1.evil.com',
    ],
    // Note: `http://127.0.0` is canonicalized to hostname `127.0.0.0` by the
    // WHATWG URL parser (and is a real loopback literal), so we can't use it
    // as a "rejected" case. Likewise `http://127.0.0.256` THROWS at parse
    // time, so the helper rejects it via the try/catch fallback rather than
    // via the regex — covered below as a parse-failure case.
    [
      'http 127.0.0.256 (URL parse fails — octet out of range)',
      'http://127.0.0.256',
    ],
    [
      'http 127.0.0.1.1 (URL parse fails — too many octets)',
      'http://127.0.0.1.1',
    ],
    // P2 — restricting the loopback exception to http:// only.
    ['ftp on loopback', 'ftp://localhost:11500'],
    ['file on loopback IPv4', 'file://127.0.0.1'],
    ['ws on loopback', 'ws://localhost:11500'],
    ['not a url', 'not a url'],
  ];

  it.each(accepted)('accepts: %s', async (_label, url) => {
    const { isAllowedLlmServerUrl } = await import('@/env');
    expect(isAllowedLlmServerUrl(url)).toBe(true);
  });

  it.each(rejected)('rejects: %s', async (_label, url) => {
    const { isAllowedLlmServerUrl } = await import('@/env');
    expect(isAllowedLlmServerUrl(url)).toBe(false);
  });
});

describe('recovery-code env', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    stubBaseEnv();
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('requires RECOVERY_CODE_PEPPER when passkey recovery is enabled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED', 'true');
    delete process.env.RECOVERY_CODE_PEPPER;

    await expect(loadEnvModule()).rejects.toThrow('RECOVERY_CODE_PEPPER');
  });

  it('allows passkey recovery when RECOVERY_CODE_PEPPER is provisioned', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED', 'true');
    vi.stubEnv('RECOVERY_CODE_PEPPER', 'x'.repeat(32));

    await expect(loadEnvModule()).resolves.toBeDefined();
  });

  it('returns the trimmed runtime recovery-code pepper', async () => {
    vi.stubEnv('RECOVERY_CODE_PEPPER', `  ${'x'.repeat(32)}  `);

    const { getRecoveryCodePepper } = await loadEnvModule();

    expect(getRecoveryCodePepper()).toBe('x'.repeat(32));
  });
});
