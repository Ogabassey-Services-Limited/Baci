import { describe, expect, it } from 'vitest';
import { StorefrontBlogPostSchema } from './storefront-blog-post-schema';

const blogPost = {
  authorName: 'Store Editor',
  category: 'Buying Guides',
  content: 'Published guide content',
  excerpt: 'A short listing summary.',
  featuredImageUrl: 'https://cdn.example.com/guides/phone.png',
  id: '123e4567-e89b-42d3-a456-426614174070',
  publishedAt: '2026-08-25T14:00:00+01:00',
  seoDescription: 'Compare the best phones.',
  seoTitle: 'Best phones',
  slug: 'best-phones',
  status: 'published',
  title: 'Best phones',
} as const;

describe('StorefrontBlogPostSchema', () => {
  it('preserves bounded listing, author, category, image, and SEO fields', () => {
    expect(StorefrontBlogPostSchema.parse(blogPost)).toEqual(blogPost);
  });

  it('rejects a signed featured image URL', () => {
    expect(
      StorefrontBlogPostSchema.safeParse({
        ...blogPost,
        featuredImageUrl: 'https://cdn.example.com/cover.png?token=secret',
      }).success
    ).toBe(false);
  });

  it('rejects non-published blog rows', () => {
    expect(
      StorefrontBlogPostSchema.safeParse({ ...blogPost, status: 'draft' })
        .success
    ).toBe(false);
  });
});
