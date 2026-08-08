import type {
  BuilderAiProposedPlan,
  BuilderData,
} from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import { applyBuilderAiEditPlan } from './apply-builder-ai-edit-plan';

describe('applyBuilderAiEditPlan insert offsets', () => {
  it('inserts directly after an anchor moved between inserts', () => {
    // Arrange
    const currentConfig: BuilderData = {
      content: [
        { props: { id: 'anchor' }, type: 'Hero' },
        { props: { id: 'before' }, type: 'Text' },
        { props: { id: 'following' }, type: 'Text' },
      ],
      root: { title: 'Home' },
    };
    const plan = {
      operations: [
        {
          initialContent: { componentType: 'Text', title: 'First' },
          kind: 'insert_component',
          placement: { componentId: 'anchor', position: 'after' },
        },
        {
          componentId: 'anchor',
          destination: { componentId: 'before', position: 'after' },
          kind: 'move_component',
        },
        {
          initialContent: { componentType: 'Newsletter', title: 'Second' },
          kind: 'insert_component',
          placement: { componentId: 'anchor', position: 'after' },
        },
      ],
      status: 'proposed',
      summary: 'Insert around a moved anchor',
    } as BuilderAiProposedPlan;

    // Act
    const result = applyBuilderAiEditPlan(
      currentConfig,
      plan,
      (type) => `new-${type}`
    );

    // Assert
    expect(result.candidateConfig.content.map((item) => item.props.id)).toEqual(
      ['new-Text', 'before', 'anchor', 'new-Newsletter', 'following']
    );
  });
});
