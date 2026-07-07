import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('getCopilotTextProviderChain', () => {
  it('orders Cerebras → Groq → Gemini → Gemini-Lite → OpenRouter when all provider keys are set', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test');

    const { getCopilotTextProviderChain } = await import(
      './copilot-provider-chain'
    );
    const names = getCopilotTextProviderChain().map((p) => p.name);

    expect(names).toEqual([
      'cerebras:gemma-4-31b',
      'groq:openai/gpt-oss-120b',
      'google:gemini-2.5-flash',
      'google:gemini-2.5-flash-lite',
      'openrouter:google/gemma-4-31b-it:free',
    ]);
  });

  it('degrades to the Gemini-only chain when no provider keys are configured', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const { getCopilotTextProviderChain } = await import(
      './copilot-provider-chain'
    );
    const names = getCopilotTextProviderChain().map((p) => p.name);

    expect(names).toEqual([
      'google:gemini-2.5-flash',
      'google:gemini-2.5-flash-lite',
    ]);
  });

  it('includes only the provider whose key is configured', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const { getCopilotTextProviderChain } = await import(
      './copilot-provider-chain'
    );
    const names = getCopilotTextProviderChain().map((p) => p.name);

    expect(names).toEqual([
      'groq:openai/gpt-oss-120b',
      'google:gemini-2.5-flash',
      'google:gemini-2.5-flash-lite',
    ]);
  });

  it('flags ONLY the OpenRouter link as opportunistic (never reserve deadline for it)', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test');

    const { getCopilotTextProviderChain } = await import(
      './copilot-provider-chain'
    );
    const chain = getCopilotTextProviderChain();

    const opportunistic = chain.filter((p) => p.opportunistic);
    expect(opportunistic.map((p) => p.name)).toEqual([
      'openrouter:google/gemma-4-31b-it:free',
    ]);
    // The two Gemini fallbacks must NOT be opportunistic — they are the
    // reliable tail that must get real deadline budget.
    expect(
      chain.find((p) => p.name === 'google:gemini-2.5-flash-lite')
        ?.opportunistic
    ).toBeFalsy();
  });

  it('keeps the Gemini models ahead of the contended OpenRouter free pool', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test');

    const { getCopilotTextProviderChain } = await import(
      './copilot-provider-chain'
    );
    const chain = getCopilotTextProviderChain();

    expect(chain.at(-3)?.name).toBe('google:gemini-2.5-flash');
    expect(chain.at(-2)?.name).toBe('google:gemini-2.5-flash-lite');
    expect(chain.at(-1)?.name).toBe('openrouter:google/gemma-4-31b-it:free');
    for (const provider of chain) {
      expect(provider.model).toBeDefined();
    }
  });
});
