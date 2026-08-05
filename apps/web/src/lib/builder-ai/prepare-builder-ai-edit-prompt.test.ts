import { builderAiEditTestFixture } from '@baci/shared/test-fixtures/builder-ai-edit';
import { describe, expect, it } from 'vitest';
import { prepareBuilderAiEditPrompt } from './prepare-builder-ai-edit-prompt';

describe('prepareBuilderAiEditPrompt', () => {
  it('maps projection safety failures to a stable client-safe result', () => {
    expect(
      prepareBuilderAiEditPrompt({
        currentConfig: {
          ...builderAiEditTestFixture.request.currentConfig,
          content: Array.from({ length: 101 }, (_, index) => ({
            props: { id: `hero-${index}`, title: 'Title' },
            type: 'Hero',
          })),
        },
        prompt: 'Update the hero',
      })
    ).toEqual({
      code: 'builder_ai_prompt_too_large',
      error: 'Builder AI request is too large',
      ok: false,
    });
  });
});
