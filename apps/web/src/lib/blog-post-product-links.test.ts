import { describe, expect, it } from 'vitest';
import {
  BLOG_POST_PRODUCT_LINKS_SELECT,
  normalizeBlogPostProductLink,
} from '@/lib/blog-post-product-links';

describe('blog post product links', () => {
  it('uses an explicit select list', () => {
    expect(BLOG_POST_PRODUCT_LINKS_SELECT).not.toContain('*');
    expect(BLOG_POST_PRODUCT_LINKS_SELECT).toContain('blog_post_id');
    expect(BLOG_POST_PRODUCT_LINKS_SELECT).toContain('product_id');
  });

  it('normalizes linked blog post rows for BlogSnippet', () => {
    expect(
      normalizeBlogPostProductLink({
        product_id: 'product-1',
        blog_post_id: 'post-1',
        relationship: 'primary',
        blog_posts: {
          id: 'post-1',
          title: 'iPhone 13 Buying Guide',
          slug: 'iphone-13-buying-guide',
          excerpt: 'Useful guide',
          featured_image_url:
            'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/codex/run/hero.jpg',
          category: 'Buying Guides',
          reading_time_minutes: 4,
        },
      })
    ).toMatchObject({
      id: 'post-1',
      title: 'iPhone 13 Buying Guide',
      slug: 'iphone-13-buying-guide',
    });
  });

  it('returns null for null or malformed linked post data', () => {
    expect(
      normalizeBlogPostProductLink({
        product_id: 'product-1',
        blog_post_id: 'post-1',
        relationship: 'primary',
        blog_posts: null,
      })
    ).toBeNull();

    expect(
      normalizeBlogPostProductLink({
        product_id: 'product-1',
        blog_post_id: 'post-1',
        relationship: 'primary',
        blog_posts: {
          id: 'post-1',
          title: 'Missing slug',
          slug: null,
          excerpt: null,
          featured_image_url: null,
          category: null,
          reading_time_minutes: null,
        },
      })
    ).toBeNull();
  });
});
