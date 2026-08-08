import { describe, expect, it } from 'vitest';
import { builderAiModelOperationSchema } from './model-plan-operation';

describe('builderAiModelOperationSchema', () => {
  it('accepts a supported bounded operation and rejects an unknown kind', () => {
    expect(
      builderAiModelOperationSchema.safeParse({
        kind: 'update_root',
        title: 'New title',
      }).success
    ).toBe(true);
    expect(
      builderAiModelOperationSchema.safeParse({ kind: 'unknown' }).success
    ).toBe(false);
  });

  it('rejects an empty theme color patch without a preset', () => {
    expect(
      builderAiModelOperationSchema.safeParse({
        colors: {},
        kind: 'update_theme',
      }).success
    ).toBe(false);
  });
});
