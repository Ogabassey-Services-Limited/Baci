import { describe, expect, it } from 'vitest';
import { builderGeminiRequestSchema } from './builder-gemini-request';

const merchantId = '11111111-1111-4111-8111-111111111111';

describe('builderGeminiRequestSchema', () => {
  it('trims a valid prompt and accepts a renderable builder config', () => {
    const result = builderGeminiRequestSchema.safeParse({
      merchantId,
      prompt: '  Make the hero more prominent  ',
      currentConfig: { content: [] },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe('Make the hero more prominent');
      expect(result.data.currentConfig.content).toEqual([]);
    }
  });

  it('rejects an invalid merchant, blank prompt, and malformed builder content', () => {
    expect(
      builderGeminiRequestSchema.safeParse({
        merchantId: 'merchant-a',
        prompt: 'Update the layout',
        currentConfig: { content: [] },
      }).success
    ).toBe(false);

    expect(
      builderGeminiRequestSchema.safeParse({
        merchantId,
        prompt: '   ',
        currentConfig: { content: [] },
      }).success
    ).toBe(false);

    expect(
      builderGeminiRequestSchema.safeParse({
        merchantId,
        prompt: 'Update the layout',
        currentConfig: { content: 'Hero' },
      }).success
    ).toBe(false);
  });
});
