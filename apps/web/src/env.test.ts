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

  it('defaults the terminal idempotency record window to seven days', async () => {
    const { getTerminalIdempotencyRecordWindowMs } = await loadEnvModule();

    expect(getTerminalIdempotencyRecordWindowMs()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it('uses MYCOVER_SECRET_KEY as the MyCover webhook signing secret fallback', async () => {
    delete process.env.MYCOVER_WEBHOOK_SECRET;
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

  it('returns the chat model alias gemma-4-e4b by default', async () => {
    delete process.env.LLM_CHAT_MODEL;
    const { getLlmChatModel } = await loadEnvModule();
    expect(getLlmChatModel()).toBe('gemma-4-e4b');
  });

  it('honors a configured LLM_CHAT_MODEL after sanitization', async () => {
    vi.stubEnv('LLM_CHAT_MODEL', '  gemma-4-e4b\\n\n\r ');
    const { getLlmChatModel } = await loadEnvModule();
    expect(getLlmChatModel()).toBe('gemma-4-e4b');
  });

  it('rejects blank LLM_CHAT_MODEL after sanitization', async () => {
    vi.stubEnv('LLM_CHAT_MODEL', ' \\n\n\r ');
    const { getLlmChatModel } = await loadEnvModule();
    expect(() => getLlmChatModel()).toThrow(
      'LLM_CHAT_MODEL must resolve to a non-empty model name'
    );
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
