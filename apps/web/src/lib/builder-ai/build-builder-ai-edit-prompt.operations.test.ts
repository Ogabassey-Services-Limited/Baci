import { describe, expect, it } from 'vitest';
import { buildBuilderAiEditPrompt } from './build-builder-ai-edit-prompt';

function getOperationGuide(prompt: string): Record<string, unknown> {
  return JSON.parse(
    prompt.match(/<operation-guide>(.+)<\/operation-guide>/)?.[1] ?? ''
  ) as Record<string, unknown>;
}

describe('buildBuilderAiEditPrompt operation guidance', () => {
  it('reads a bounded current root title from Puck root props', () => {
    const prompt = buildBuilderAiEditPrompt({
      currentConfig: {
        content: [],
        root: { props: { apiKey: 'root-secret', title: 'Curated homepage' } },
      },
      prompt: 'Append Sale to the current page title',
    });
    const guide = getOperationGuide(prompt) as {
      currentState: { root: { title?: string } };
    };

    expect(guide.currentState.root.title).toBe('Curated homepage');
    expect(prompt).not.toContain('root-secret');
  });

  it('publishes the exact update_theme contract for schema-less providers', () => {
    const guide = getOperationGuide(
      buildBuilderAiEditPrompt({
        currentConfig: { content: [], root: { title: 'Home' } },
        prompt: 'Use a luxury theme with a blue primary color',
      })
    ) as { updateThemeOperation: Record<string, unknown> };

    expect(guide.updateThemeOperation).toEqual({
      colors: {
        allowedKeys: [
          'primary',
          'secondary',
          'accent',
          'background',
          'foreground',
        ],
        valuePattern: '#RRGGBB',
      },
      kind: 'update_theme',
      preset: {
        allowedValues: [
          'modern',
          'minimal',
          'luxury',
          'playful',
          'bold',
          'calm',
        ],
      },
      requiresAtLeastOneOf: ['preset', 'colors'],
    });
  });

  it('keeps non-editable component ids as placement-only anchors', () => {
    const prompt = buildBuilderAiEditPrompt({
      currentConfig: {
        content: [
          {
            props: {
              id: 'image-anchor',
              src: 'https://private.test/image.jpg',
            },
            type: 'Image',
          },
        ],
        root: { title: 'Home' },
      },
      prompt: 'Add text after the image',
    });
    const components = JSON.parse(
      prompt.match(/<safe-components>(.+)<\/safe-components>/)?.[1] ?? ''
    ) as Record<string, unknown>[];

    expect(components).toContainEqual({ id: 'image-anchor', type: 'Image' });
    expect(prompt).not.toContain('private.test');
  });
});
