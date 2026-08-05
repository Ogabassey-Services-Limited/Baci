import { describe, expect, it } from 'vitest';
import {
  PLATFORM_BLOG_DETAIL_SELECT,
  platformBlogRouteParamsSchema,
} from './platform-blog-post-route-schema';

describe('platformBlogRouteParamsSchema', () => {
  it('accepts a non-empty post identifier', () => {
    expect(
      platformBlogRouteParamsSchema.safeParse({ id: 'post-1' }).success
    ).toBe(true);
  });

  it('rejects empty or missing post identifiers', () => {
    expect(platformBlogRouteParamsSchema.safeParse({ id: '' }).success).toBe(
      false
    );
    expect(platformBlogRouteParamsSchema.safeParse({}).success).toBe(false);
  });
});

describe('PLATFORM_BLOG_DETAIL_SELECT', () => {
  it('uses an explicit platform post projection', () => {
    expect(PLATFORM_BLOG_DETAIL_SELECT).toContain('id, title, slug');
    expect(PLATFORM_BLOG_DETAIL_SELECT).not.toContain('*');
  });
});
