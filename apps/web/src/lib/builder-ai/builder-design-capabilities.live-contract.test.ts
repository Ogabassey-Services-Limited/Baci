import {
  builderAiEditContract,
  builderDesignCapabilities,
} from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import { applyBuilderAiEditPlan } from './apply-builder-ai-edit-plan';
import { buildBuilderAiEditPrompt } from './build-builder-ai-edit-prompt';

function getAllowedComponentTypes(prompt: string): string[] {
  const guide = prompt.match(/<operation-guide>(.*)<\/operation-guide>/);
  if (!guide) throw new Error('Expected operation guide');
  return JSON.parse(guide[1]).allowedComponentTypes;
}

describe('builder design capability live contract', () => {
  it('advertises only components that the live model-plan executor accepts', () => {
    const prompt = buildBuilderAiEditPrompt({
      currentConfig: { content: [], root: { props: {} } },
      prompt: 'Make the storefront more compelling',
    });
    const advertised = builderDesignCapabilities.components
      .filter(({ aiEditable, aiInsertable }) => aiEditable || aiInsertable)
      .map(({ componentType }) => componentType);

    expect(advertised.sort()).toEqual(getAllowedComponentTypes(prompt).sort());
  });

  it.each([
    ['Button', { link: '/products', text: 'Shop now' }],
    ['Spacer', { height: 'medium' }],
    [
      'FAQ',
      {
        items: [
          { answer: 'Within three days.', question: 'When do you ship?' },
        ],
        title: 'Questions',
      },
    ],
    [
      'LegalSection',
      {
        sections: [{ content: 'We protect your data.', heading: 'Privacy' }],
        title: 'Privacy policy',
      },
    ],
  ])('accepts a bounded %s insert advertised by the manifest', (componentType, props) => {
    expect(
      builderAiEditContract.modelPlanSchema.safeParse({
        operations: [
          {
            initialContent: { componentType, ...props },
            kind: 'insert_component',
            placement: { position: 'first_content' },
          },
        ],
        status: 'proposed',
        summary: `Add ${componentType}`,
      }).success
    ).toBe(true);
  });

  it.each([
    ['Button', { link: '/products', text: 'Shop now' }],
    ['Spacer', { height: 'medium' }],
    [
      'FAQ',
      {
        items: [
          { answer: 'Within three days.', question: 'When do you ship?' },
        ],
        title: 'Questions',
      },
    ],
    [
      'LegalSection',
      {
        sections: [{ content: 'We protect your data.', heading: 'Privacy' }],
        title: 'Privacy policy',
      },
    ],
  ])('executes a bounded %s insert advertised by the manifest', (componentType, props) => {
    const result = applyBuilderAiEditPlan(
      { content: [], root: { props: {} } },
      {
        operations: [
          {
            initialContent: { componentType, ...props },
            kind: 'insert_component',
            placement: { position: 'first_content' },
          },
        ],
        status: 'proposed',
        summary: `Add ${componentType}`,
      } as never,
      () => `${componentType.toLowerCase()}-1`
    );

    expect(result.candidateConfig.content).toContainEqual(
      expect.objectContaining({ type: componentType })
    );
  });
});
