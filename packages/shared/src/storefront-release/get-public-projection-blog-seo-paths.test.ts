import { describe, expect, it } from 'vitest';
import { getPublicProjectionBlogSeoPaths } from './get-public-projection-blog-seo-paths';

const merchant = { hostname: 'ogabassey.com', slug: 'ogabassey' };
const post = {
  authorName: 'Bassey John',
  category: "Men's Phones",
  title: 'Published guide',
};

describe('getPublicProjectionBlogSeoPaths', () => {
  it('uses live category slugs for a single collision-free published post', () => {
    const posts = [{ ...post, slug: 'one' }];

    expect(getPublicProjectionBlogSeoPaths(posts, merchant)).toEqual([
      '/blog/author/bassey-john',
      '/blog/category/mens-phones',
    ]);
    expect(
      getPublicProjectionBlogSeoPaths(
        [...posts, { ...post, category: 'Mens Phones', slug: 'two' }],
        merchant
      )
    ).not.toContain('/blog/category/mens-phones');
  });

  it('keeps author paths tenant-gated and canonical-name matched', () => {
    const nonTenantPaths = getPublicProjectionBlogSeoPaths(
      [
        { ...post, slug: 'one' },
        { ...post, authorName: 'Unknown', slug: 'two' },
      ],
      { slug: 'merchant' }
    );
    expect(nonTenantPaths).not.toContain('/blog/author/bassey-john');
    expect(nonTenantPaths).toContain('/blog/category/mens-phones');

    const mismatchedAuthorPaths = getPublicProjectionBlogSeoPaths(
      [{ ...post, authorName: 'bassey john', slug: 'one' }],
      merchant
    );
    expect(mismatchedAuthorPaths).not.toContain('/blog/author/bassey-john');
    expect(mismatchedAuthorPaths).toContain('/blog/category/mens-phones');
  });
});
