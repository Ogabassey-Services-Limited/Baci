import { describe, expect, it } from 'vitest';
import { STOREFRONT_RELEASE_RESERVED_BLOG_SLUGS } from './reserved-blog-slugs';

describe('STOREFRONT_RELEASE_RESERVED_BLOG_SLUGS', () => {
  it('reserves the static blog route segments', () => {
    expect(STOREFRONT_RELEASE_RESERVED_BLOG_SLUGS).toEqual(
      new Set(['author', 'category'])
    );
  });
});
