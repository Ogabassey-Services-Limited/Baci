import { describe, expect, it } from 'vitest';
import {
  updateCountsForDeletion,
  updateCountsForStatus,
} from './blog-client-counts';

const post = {
  status: 'draft' as const,
} as Parameters<typeof updateCountsForDeletion>[1];

describe('blog client counts', () => {
  it('moves one post between status totals', () => {
    expect(
      updateCountsForStatus(
        { archived: 0, draft: 1, published: 0, total: 1 },
        'draft',
        'published'
      )
    ).toEqual({ archived: 0, draft: 0, published: 1, total: 1 });
  });

  it('updates the global total when deleting and restoring a post', () => {
    const before = { archived: 0, draft: 1, published: 2, total: 3 };
    const afterDelete = updateCountsForDeletion(before, post, -1);

    expect(afterDelete).toEqual({
      archived: 0,
      draft: 0,
      published: 2,
      total: 2,
    });
    expect(updateCountsForDeletion(afterDelete, post, 1)).toEqual(before);
  });
});
