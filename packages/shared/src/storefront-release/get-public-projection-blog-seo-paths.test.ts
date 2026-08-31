import { describe, expect, it } from 'vitest';
import { getPublicProjectionBlogSeoPaths } from './get-public-projection-blog-seo-paths';

const merchant = { hostname: 'ogabassey.com', slug: 'ogabassey' };
const post = {
  authorName: 'Bassey John',
  category: "Men's Phones",
  title: 'Published guide',
};

describe('getPublicProjectionBlogSeoPaths', () => {
  it('uses live category slugs and requires three collision-free posts', () => {
    const posts = [
      { ...post, slug: 'one' },
      { ...post, slug: 'two' },
      { ...post, slug: 'three' },
    ];

    expect(getPublicProjectionBlogSeoPaths(posts, merchant)).toEqual([
      '/blog/author/bassey-john',
      '/blog/category/mens-phones',
    ]);
    expect(
      getPublicProjectionBlogSeoPaths(
        [...posts, { ...post, category: 'Mens Phones', slug: 'four' }],
        merchant
      )
    ).not.toContain('/blog/category/mens-phones');
  });

  it('keeps author paths tenant-gated and canonical-name matched', () => {
    expect(
      getPublicProjectionBlogSeoPaths(
        [{ ...post, slug: 'one' }, { ...post, authorName: 'Unknown', slug: 'two' }],
        { slug: 'merchant' }
      )
    ).toEqual([]);
    expect(
      getPublicProjectionBlogSeoPaths(
        [{ ...post, authorName: 'bassey john', slug: 'one' }],
        merchant
      )
    ).toEqual([]);
  });
});
