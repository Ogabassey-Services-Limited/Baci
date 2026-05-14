import { describe, expect, it } from 'vitest';
import { incrementViewCountPostIdSchema } from './blog-post-view-count';

describe('incrementViewCountPostIdSchema', () => {
  it('accepts and trims non-empty post ids', () => {
    const result = incrementViewCountPostIdSchema.safeParse(' post-123 ');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('post-123');
    }
  });

  it('rejects blank and non-string post ids', () => {
    expect(incrementViewCountPostIdSchema.safeParse('   ').success).toBe(false);
    expect(incrementViewCountPostIdSchema.safeParse(null).success).toBe(false);
  });
});
