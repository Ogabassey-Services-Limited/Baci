import { describe, expect, it } from 'vitest';
import { merchantBlogPostsListQuerySchema } from './merchant-blog-posts-list-query';

describe('merchantBlogPostsListQuerySchema', () => {
  it('uses bounded pagination and deterministic defaults', () => {
    expect(merchantBlogPostsListQuerySchema.parse({})).toMatchObject({
      limit: 20,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  });

  it('rejects unsupported sorting and unsafe filter values', () => {
    expect(
      merchantBlogPostsListQuerySchema.safeParse({
        sortBy: 'merchant_id',
        status: 'scheduled',
        limit: '0',
      }).success
    ).toBe(false);
  });
});
