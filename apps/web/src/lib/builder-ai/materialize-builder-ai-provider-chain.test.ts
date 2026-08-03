import { describe, expect, it } from 'vitest';
import { materializeBuilderAiProviderChain } from './materialize-builder-ai-provider-chain';

describe('materializeBuilderAiProviderChain', () => {
  it('returns a typed no-provider result rather than a Google, Gemini, or Ollama fallback', () => {
    expect(
      materializeBuilderAiProviderChain(
        {},
        {
          createCerebrasModel: () => ({}) as never,
          createGroqModel: () => ({}) as never,
          createOpenRouterModel: () => ({}) as never,
        }
      )
    ).toEqual({ code: 'ai_provider_unavailable', providers: [] });
  });
});
