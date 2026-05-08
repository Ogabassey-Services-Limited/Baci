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
  });

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

  it('loads server env when required production secrets are present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_JWT_SECRET', 'legacy-test-secret');

    await expect(loadEnvModule()).resolves.toBeDefined();
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
      getAgenticConfirmationKeys,
      getAgenticSigningKeys,
      getPaystackSecretKey,
      getSupabaseAgenticJwtPrivateJwk,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBe('agent-api-key');
    expect(getAgenticConfirmationKeys()).toEqual(['confirmation-key']);
    expect(getAgenticSigningKeys()).toEqual(['signing-key']);
    expect(getPaystackSecretKey()).toBe('paystack-secret');
    expect(getSupabaseAgenticJwtPrivateJwk()).toBe(validAgenticPrivateJwk);
  });

  it('treats empty agentic runtime secrets as unset', async () => {
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', '');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', '');
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    const {
      getAgenticApiKey,
      getAgenticConfirmationKeys,
      getAgenticSigningKeys,
      getPaystackSecretKey,
    } = await loadEnvModule();

    expect(getAgenticApiKey()).toBeUndefined();
    expect(getAgenticConfirmationKeys()).toEqual([]);
    expect(getAgenticSigningKeys()).toEqual([]);
    expect(getPaystackSecretKey()).toBeUndefined();
  });

  it('includes current and previous agentic rotation keys after trimming', async () => {
    vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', ' current-confirmation ');
    vi.stubEnv(
      'OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS',
      ' previous-confirmation '
    );
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', ' current-signing ');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', ' previous-signing ');
    const { getAgenticConfirmationKeys, getAgenticSigningKeys } =
      await loadEnvModule();

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
});
