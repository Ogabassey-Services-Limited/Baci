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
    CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG:
      '16afb34860df51646e6ec17cae61a877108b77e9caf38d75e2d4a9ff170f0f13',
    CEREBRAS_BUILDER_APPROVED_MODEL: 'gemma-4-31b',
    CEREBRAS_BUILDER_DEPLOYMENT_TIER: 'approved-reliable',
    CEREBRAS_BUILDER_RELEASE_ATTESTED_AT: '2026-08-01T00:00:00.000Z',
    GROQ_API_KEY: 'groq-key',
    GROQ_BUILDER_ACCOUNT_REF: 'groq-account',
    GROQ_BUILDER_CREDENTIAL_BINDING_TAG:
      '09a312cd282ac8d7295562184044f6a111437ad8fcb5e4bb74f6231058b6fb96',
    GROQ_BUILDER_APPROVED_MODEL: 'openai/gpt-oss-120b',
    GROQ_BUILDER_DEPLOYMENT_TIER: 'approved-reliable',
    GROQ_BUILDER_RELEASE_ATTESTED_AT: '2026-08-01T00:00:00.000Z',
    BUILDER_AI_PROVIDER_BINDING_PEPPER: 'builder-binding-pepper',
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

  it('fails closed when a keyed credential-binding tag does not bind to the deployed key', () => {
    expect(
      materializeBuilderAiProviders(
        {
          ...attestedEnvironment,
          GROQ_BUILDER_CREDENTIAL_BINDING_TAG: '0'.repeat(64),
        },
        factories,
        { now: Date.parse('2026-08-05T00:00:00.000Z') }
      )
    ).toEqual([]);
  });

  it('fails closed for a wrong pepper, a cross-provider tag, or malformed tag', () => {
    const now = Date.parse('2026-08-05T00:00:00.000Z');
    for (const environment of [
      { ...attestedEnvironment, CEREBRAS_API_KEY: 'wrong-cerebras-key' },
      {
        ...attestedEnvironment,
        BUILDER_AI_PROVIDER_BINDING_PEPPER: 'wrong-pepper',
      },
      {
        ...attestedEnvironment,
        GROQ_BUILDER_CREDENTIAL_BINDING_TAG:
          attestedEnvironment.CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG,
      },
      {
        ...attestedEnvironment,
        CEREBRAS_BUILDER_CREDENTIAL_BINDING_TAG: 'bad-tag',
      },
    ]) {
      expect(
        materializeBuilderAiProviders(environment, factories, { now })
      ).toEqual([]);
    }
  });

  it('fails closed when a release record omits its binding pepper or provider tag', () => {
    const now = Date.parse('2026-08-05T00:00:00.000Z');
    expect(
      materializeBuilderAiProviders(
        { ...attestedEnvironment, BUILDER_AI_PROVIDER_BINDING_PEPPER: '' },
        factories,
        { now }
      )
    ).toEqual([]);
    expect(
      materializeBuilderAiProviders(
        { ...attestedEnvironment, GROQ_BUILDER_CREDENTIAL_BINDING_TAG: '' },
        factories,
        { now }
      )
    ).toEqual([]);
  });

  it('fails closed for an expired release attestation or a model mismatch', () => {
    const now = Date.parse('2026-08-05T00:00:00.000Z');
    expect(
      materializeBuilderAiProviders(
        {
          ...attestedEnvironment,
          CEREBRAS_BUILDER_RELEASE_ATTESTED_AT: '2026-01-01T00:00:00.000Z',
        },
        factories,
        { now }
      )
    ).toEqual([]);
    expect(
      materializeBuilderAiProviders(
        { ...attestedEnvironment, GROQ_BUILDER_APPROVED_MODEL: 'wrong-model' },
        factories,
        { now }
      )
    ).toEqual([]);
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
