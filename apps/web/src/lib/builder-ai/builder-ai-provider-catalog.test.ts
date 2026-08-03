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
  it('materializes each configured provider independently in the pinned order', () => {
    expect(
      materializeBuilderAiProviders(
        {
          CEREBRAS_API_KEY: 'cerebras-key',
          OPENROUTER_API_KEY: 'openrouter-key',
        },
        factories
      ).map(({ name }) => name)
    ).toEqual([
      'cerebras:gemma-4-31b',
      'openrouter:google/gemma-4-31b-it:free',
    ]);
    expect(factories.createGroqModel).not.toHaveBeenCalled();
  });

  it('returns an empty catalog when no provider credentials are configured', () => {
    expect(materializeBuilderAiProviders({}, factories)).toEqual([]);
  });
});
