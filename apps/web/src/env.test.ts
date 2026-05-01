// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
