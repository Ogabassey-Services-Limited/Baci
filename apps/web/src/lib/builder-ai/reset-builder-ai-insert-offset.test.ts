import { describe, expect, it } from 'vitest';
import type { BuilderAiComponent } from './get-builder-ai-content-collections';
import { getBuilderAiInsertOffset } from './get-builder-ai-insert-offset';
import { resetBuilderAiInsertOffset } from './reset-builder-ai-insert-offset';

describe('resetBuilderAiInsertOffset', () => {
  it('clears only the moved anchor after-placement offset', () => {
    const offsets = new WeakMap<BuilderAiComponent[], Map<string, number>>();
    const content: BuilderAiComponent[] = [];

    getBuilderAiInsertOffset(offsets, content, {
      componentId: 'anchor',
      position: 'after',
    });
    resetBuilderAiInsertOffset(offsets, content, 'anchor');

    expect(
      getBuilderAiInsertOffset(offsets, content, {
        componentId: 'anchor',
        position: 'after',
      })
    ).toBe(0);
  });

  it('does not require offset state for an anchor without prior inserts', () => {
    const offsets = new WeakMap<BuilderAiComponent[], Map<string, number>>();

    expect(() =>
      resetBuilderAiInsertOffset(offsets, [], 'untracked-anchor')
    ).not.toThrow();
  });
});
