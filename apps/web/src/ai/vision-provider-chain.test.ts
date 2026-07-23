import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('getVisionProviderChain', () => {
  it('keeps Cerebras and both Gemini tiers, dropping text-only Groq and opportunistic OpenRouter', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test');

    const { getVisionProviderChain } = await import('./vision-provider-chain');
    const names = getVisionProviderChain().map((p) => p.name);

    expect(names).toEqual([
      'cerebras:gemma-4-31b',
      'google:gemini-2.5-flash',
      'google:gemini-2.5-flash-lite',
    ]);
  });

  it('degrades to the Gemini-only vision chain without a Cerebras key', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const { getVisionProviderChain } = await import('./vision-provider-chain');
    const names = getVisionProviderChain().map((p) => p.name);

    expect(names).toEqual([
      'google:gemini-2.5-flash',
      'google:gemini-2.5-flash-lite',
    ]);
  });
});
