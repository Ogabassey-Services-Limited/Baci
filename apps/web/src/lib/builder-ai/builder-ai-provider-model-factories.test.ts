import { describe, expect, it } from 'vitest';
import { builderAiProviderModelFactories } from './builder-ai-provider-model-factories';

describe('builder AI provider model factories', () => {
  it('exports lazy factories rather than a constructed provider catalog', () => {
    expect(typeof builderAiProviderModelFactories.createCerebrasModel).toBe(
      'function'
    );
    expect(typeof builderAiProviderModelFactories.createGroqModel).toBe(
      'function'
    );
    expect(typeof builderAiProviderModelFactories.createOpenRouterModel).toBe(
      'function'
    );
  });
});
