import { describe, expect, it } from 'vitest';
import { buildBlogPostMarkdown } from '@/lib/llms-markdown-blog/build-blog-post-markdown';

describe('buildBlogPostMarkdown', () => {
  it('builds sanitized blog post summary metadata', () => {
    const result = buildBlogPostMarkdown(
      { business_name: '<b>Ogabassey</b>' },
      'https://ogabassey.com/',
      {
        title: '<b>Post</b>',
        slug: 'post slug',
        excerpt: '<b>Safe summary</b>',
        author_name: '<i>Editor</i>',
        category: '<b>Guides</b>',
        reading_time_minutes: 5,
        tags: ['<b>Deals</b>'],
      }
    );

    expect(result).toContain('# Post');
    expect(result).toContain('> Safe summary');
    expect(result).toContain('- Publisher: Ogabassey');
    expect(result).toContain('- Author: Editor');
    expect(result).toContain('- Category: Guides');
    expect(result).toContain('- Reading time: 5 minutes');
    expect(result).toContain('- Tags: Deals');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<i>');
    expect(result).not.toMatch(/<[^>]+>/);
    expect(result).not.toContain('https://ogabassey.com//');
  });

  it('omits optional metadata and falls back when content is missing', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Plain post',
        slug: 'plain-post',
      }
    );

    expect(result).toContain('> Read this post.');
    expect(result).not.toContain('- Author:');
    expect(result).not.toContain('- Category:');
    expect(result).not.toContain('- Published:');
    expect(result).not.toContain('- Reading time:');
    expect(result).not.toContain('- Tags:');
  });

  it('falls back for blank title and omits malformed slug links', () => {
    const result = buildBlogPostMarkdown(
      { business_name: '' },
      'https://ogabassey.com/',
      {
        title: '<b></b>',
        slug: ' ',
        excerpt: 'Preview',
      }
    );

    expect(result).toContain('# Untitled post');
    expect(result).not.toContain('- Publisher:');
    expect(result).not.toContain('- Canonical blog URL:');
    expect(result).not.toContain('- Markdown mirror:');
    expect(result).not.toContain('/blog/.md');
    expect(result).not.toContain('https://ogabassey.com//');
  });

  it('joins multiple tags and formats singular reading time', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Tagged post',
        slug: 'tagged-post',
        excerpt: 'Tagged preview',
        reading_time_minutes: 1,
        tags: ['One', 'Two', 'Three'],
      }
    );

    expect(result).toContain('- Reading time: 1 minute');
    expect(result).toContain('- Tags: One, Two, Three');
  });

  it('omits empty tags and nullish or zero reading times', () => {
    const zeroReadingTime = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Zero reading time',
        slug: 'zero-reading-time',
        excerpt: 'Preview',
        reading_time_minutes: 0,
        tags: [],
      }
    );
    const nullReadingTime = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Null reading time',
        slug: 'null-reading-time',
        excerpt: 'Preview',
        reading_time_minutes: null,
      }
    );

    expect(zeroReadingTime).not.toContain('- Reading time:');
    expect(zeroReadingTime).not.toContain('- Tags:');
    expect(nullReadingTime).not.toContain('- Reading time:');
  });

  it('renders sanitized published metadata when present', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Published post',
        slug: 'published-post',
        excerpt: 'Published preview',
        published_at: '<b>2026-04-29</b>',
      }
    );

    expect(result).toContain('- Published: 2026\\-04\\-29');
    expect(result).not.toContain('<b>');
  });

  it('escapes markdown control characters in post fields', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: '# Title **bold**',
        slug: 'escaped-post',
        excerpt: '> blockquote',
        tags: ['`code`', '[link]'],
      }
    );

    expect(result).toContain('# \\# Title \\*\\*bold\\*\\*');
    expect(result).toContain('> \\> blockquote');
    expect(result).toContain('- Tags: \\`code\\`, \\[link\\]');
    expect(result).not.toContain('**bold**');
  });
});
