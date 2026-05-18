import { describe, expect, it } from 'vitest';
import { adminPlatformBlogPostsListQuerySchema } from '@/schemas/admin-platform-blog-posts';

describe('adminPlatformBlogPostsListQuerySchema', () => {
  it('defaults limit and offset when omitted', () => {
    const result = adminPlatformBlogPostsListQuerySchema.parse({});

    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it('accepts valid limit and offset values', () => {
    const result = adminPlatformBlogPostsListQuerySchema.parse({
      limit: '50',
      offset: '10',
    });

    expect(result).toEqual({ limit: 50, offset: 10 });
  });

  it('rejects out-of-range values', () => {
    const tooLargeLimit = adminPlatformBlogPostsListQuerySchema.safeParse({
      limit: 200,
      offset: 0,
    });
    const negativeOffset = adminPlatformBlogPostsListQuerySchema.safeParse({
      limit: 10,
      offset: -1,
    });

    expect(tooLargeLimit.success).toBe(false);
    expect(negativeOffset.success).toBe(false);
  });
});
