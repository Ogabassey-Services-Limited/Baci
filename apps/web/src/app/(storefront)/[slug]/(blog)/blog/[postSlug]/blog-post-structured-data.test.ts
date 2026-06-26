import { describe, expect, it } from 'vitest';
import { buildBlogPostStructuredData } from './blog-post-structured-data';

describe('buildBlogPostStructuredData', () => {
  it('adds VideoObject metadata when the post contains an owned YouTube video', () => {
    const data = buildBlogPostStructuredData({
      author: {
        name: 'Bolakale',
        url: 'https://ogabassey.com/blog/author/bolakale',
      },
      baseUrl: 'https://ogabassey.com',
      blogIndexUrl: 'https://ogabassey.com/blog',
      content:
        '<p>Watch: <a href="https://youtu.be/tp-AlU5FVpE">unboxing</a></p>',
      merchant: {
        business_name: 'Ogabassey',
        logo_url: null,
        slug: 'ogabassey',
        social_media: null,
      },
      post: {
        author_name: 'Bolakale',
        category: 'Smartphones',
        content: '<p>Body</p>',
        excerpt: 'Pixel unboxing for Nigerian buyers.',
        keywords: ['pixel', 'fold'],
        published_at: '2026-06-25T08:00:00.000Z',
        reading_time_minutes: 4,
        title: 'Google Pixel 9 Pro Fold Unboxing',
        updated_at: '2026-06-25T09:00:00.000Z',
        word_count: 900,
      },
      postUrl: 'https://ogabassey.com/blog/pixel-9-pro-fold-unboxing',
    });

    expect(data.videoMetadata?.schema).toMatchObject({
      '@type': 'VideoObject',
      embedUrl: 'https://www.youtube.com/embed/tp-AlU5FVpE',
      uploadDate: '2026-06-25T08:00:00.000Z',
    });
    expect(data.blogSchema).toMatchObject({
      '@type': 'BlogPosting',
      articleSection: 'Smartphones',
      headline: 'Google Pixel 9 Pro Fold Unboxing',
    });
  });
});
