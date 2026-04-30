// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = process.env;

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
}

function loadEnvModule() {
  vi.resetModules();
  return import('@/env');
}

describe('env model getters', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    const { SUPABASE_JWT_SECRET: _jwtSecret, ...sanitizedEnv } = originalEnv;
    process.env = {
      ...sanitizedEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NODE_ENV: 'production',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rejects production boot when SUPABASE_JWT_SECRET is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(import('@/env')).rejects.toThrow('SUPABASE_JWT_SECRET');
  });

  it('rejects server boot when the service role key is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import('@/env')).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('loads server env when required production secrets are present', async () => {
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';

    await expect(import('@/env')).resolves.toBeDefined();
  });

  it('loads client env without requiring server-only secrets', async () => {
    vi.stubGlobal('window', {});
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import('@/env')).resolves.toBeDefined();
  });
});
