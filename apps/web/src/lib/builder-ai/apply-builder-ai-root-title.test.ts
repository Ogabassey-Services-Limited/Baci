import { describe, expect, it } from 'vitest';
import { applyBuilderAiRootTitle } from './apply-builder-ai-root-title';

describe('applyBuilderAiRootTitle', () => {
  it('updates both Puck root title representations', () => {
    const result = applyBuilderAiRootTitle(
      { props: { title: 'Old' }, title: 'Old' },
      'New'
    );
    expect(result).toEqual({
      changed: true,
      root: { props: { title: 'New' }, title: 'New' },
    });
  });
});
