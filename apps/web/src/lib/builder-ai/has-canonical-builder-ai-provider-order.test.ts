import { describe, expect, it } from 'vitest';
import { hasCanonicalBuilderAiProviderOrder } from './has-canonical-builder-ai-provider-order';

describe('hasCanonicalBuilderAiProviderOrder', () => {
  it('accepts the reliable pair and optional opportunistic tail only', () => {
    expect(
      hasCanonicalBuilderAiProviderOrder([
        { name: 'cerebras:gemma-4-31b' },
        { name: 'groq:openai/gpt-oss-120b' },
      ])
    ).toBe(true);
    expect(
      hasCanonicalBuilderAiProviderOrder([
        { name: 'groq:openai/gpt-oss-120b' },
        { name: 'cerebras:gemma-4-31b' },
      ])
    ).toBe(false);
  });
});
