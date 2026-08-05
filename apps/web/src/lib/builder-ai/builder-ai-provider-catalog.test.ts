import { describe, expect, it, vi } from 'vitest';
import {
  type BuilderAiProviderFactories,
  materializeBuilderAiProviders,
} from './builder-ai-provider-catalog';

const factories: BuilderAiProviderFactories = {
  createCerebrasModel: vi.fn((key) => ({ provider: 'cerebras', key }) as never),
  createGroqModel: vi.fn((key) => ({ provider: 'groq', key }) as never),
  createOpenRouterModel: vi.fn(
    (key) => ({ provider: 'openrouter', key }) as never
  ),
};

describe('builder AI provider catalog', () => {
  const attestedEnvironment = {
    CEREBRAS_API_KEY: 'cerebras-key',
    CEREBRAS_BUILDER_ACCOUNT_REF: 'cerebras-account',
    CEREBRAS_BUILDER_TIER_ATTESTED_AT: '2026-08-01T00:00:00.000Z',
    GROQ_API_KEY: 'groq-key',
    GROQ_BUILDER_ACCOUNT_REF: 'groq-account',
    GROQ_BUILDER_TIER_ATTESTED_AT: '2026-08-01T00:00:00.000Z',
  };

  it('fails closed without both credential-bound reliable-provider attestations', () => {
    expect(
      materializeBuilderAiProviders(
        { CEREBRAS_API_KEY: 'cerebras-key' },
        factories,
        { now: Date.parse('2026-08-05T00:00:00.000Z') }
      )
    ).toEqual([]);
    expect(factories.createCerebrasModel).not.toHaveBeenCalled();
  });

  it('materializes the approved reliable pair and gates OpenRouter on exact runtime approval', () => {
    expect(
      materializeBuilderAiProviders(
        {
          ...attestedEnvironment,
          OPENROUTER_API_KEY: 'openrouter-key',
        },
        factories,
        { now: Date.parse('2026-08-05T00:00:00.000Z') }
      ).map(({ name }) => name)
    ).toEqual(['cerebras:gemma-4-31b', 'groq:openai/gpt-oss-120b']);

    expect(
      materializeBuilderAiProviders(
        {
          ...attestedEnvironment,
          OPENROUTER_API_KEY: 'openrouter-key',
          OPENROUTER_BUILDER_TRANSPORT_APPROVED_AT: '2026-08-01T00:00:00.000Z',
          OPENROUTER_BUILDER_TRANSPORT_APPROVED_MODEL:
            'google/gemma-4-31b-it:free',
        },
        factories,
        { now: Date.parse('2026-08-05T00:00:00.000Z') }
      ).map(({ name }) => name)
    ).toEqual([
      'cerebras:gemma-4-31b',
      'groq:openai/gpt-oss-120b',
      'openrouter:google/gemma-4-31b-it:free',
    ]);
  });

  it('allows the pinned optional transport only for an explicitly approved smoke run', () => {
    expect(
      materializeBuilderAiProviders(
        {
          ...attestedEnvironment,
          OPENROUTER_API_KEY: 'openrouter-key',
        },
        factories,
        {
          now: Date.parse('2026-08-05T00:00:00.000Z'),
          purpose: 'smoke',
        }
      ).map(({ name }) => name)
    ).toEqual([
      'cerebras:gemma-4-31b',
      'groq:openai/gpt-oss-120b',
      'openrouter:google/gemma-4-31b-it:free',
    ]);
  });

  it('returns an empty catalog when no provider credentials are configured', () => {
    expect(materializeBuilderAiProviders({}, factories)).toEqual([]);
  });
});
