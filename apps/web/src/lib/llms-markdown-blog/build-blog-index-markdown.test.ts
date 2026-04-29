import { describe, expect, it } from 'vitest';
import { buildBlogIndexMarkdown } from '@/lib/llms-markdown-blog/build-blog-index-markdown';

describe('buildBlogIndexMarkdown', () => {
  it('builds sanitized blog index links with fallback excerpts', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: '<b>Ogabassey</b>' },
      'https://ogabassey.com/',
      [
        {
          title: '<b>Guide</b>',
          slug: 'guide post',
          excerpt: '<b></b>',
          reading_time_minutes: 3,
        },
      ],
      ['<i>Guides</i>']
    );

    expect(result).toContain('# Ogabassey Blog');
    expect(result).toContain('- Categories: Guides');
    expect(result).toContain(
      '- [Guide](https://ogabassey.com/blog/guide%20post.md): Published blog post (3 min read)'
    );
    expect(result).not.toContain('<b>');
    expect(result).not.toMatch(/<[^>]+>/);
    expect(result).not.toContain('https://ogabassey.com//');
  });

  it('uses a fallback label when a sanitized post title is empty', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: '<b></b>',
          slug: 'untitled-post',
        },
      ],
      []
    );

    expect(result).toContain(
      '- [Untitled post](https://ogabassey.com/blog/untitled-post.md): Published blog post'
    );
  });

  it('handles empty post lists without malformed post links', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      [],
      []
    );

    expect(result).toContain('## Posts');
    expect(result).not.toContain('.md):');
  });

  it('fails soft for malformed runtime input', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: '' },
      'https://ogabassey.com/',
      [
        null,
        undefined,
        { title: 'Missing slug' },
        {
          title: 'Valid post',
          slug: 'valid-post',
          reading_time_minutes: 0,
        },
      ] as unknown as Parameters<typeof buildBlogIndexMarkdown>[2],
      null as unknown as string[]
    );

    expect(result).toContain('# Blog');
    expect(result).toContain(
      '> Latest published articles and editorial content.'
    );
    expect(result).toContain(
      '- [Valid post](https://ogabassey.com/blog/valid-post.md): Published blog post'
    );
    expect(result).not.toContain('- Categories:');
    expect(result).not.toContain('min read');
    expect(result).not.toContain('/blog/undefined.md');
    expect(result).not.toContain('/blog/.md');
  });

  it('preserves multi-post order and encodes special slug characters', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: 'First post',
          slug: 'first post +',
          reading_time_minutes: 2.7,
        },
        {
          title: 'Second post',
          slug: 'second/post?',
        },
        {
          title: 'Skipped post',
          slug: ' ',
        },
      ],
      []
    );

    const firstIndex = result.indexOf('[First post]');
    const secondIndex = result.indexOf('[Second post]');

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(result).toContain(
      'https://ogabassey.com/blog/first%20post%20%2B.md'
    );
    expect(result).toContain('https://ogabassey.com/blog/second%2Fpost%3F.md');
    expect(result).toContain('(3 min read)');
    expect(result).not.toContain('[Skipped post]');
    expect(result).not.toContain('/blog/.md');
  });

  it('sanitizes categories and omits empty category labels', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      [],
      ['', '<b>Tech</b>', 'Business', '<script>alert(1)</script>']
    );

    expect(result).toContain('- Categories: Tech, Business, alert\\(1\\)');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<script>');
  });
});
