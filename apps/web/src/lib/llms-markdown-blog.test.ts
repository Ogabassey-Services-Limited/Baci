import { describe, expect, it } from 'vitest';
import {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
} from '@/lib/llms-markdown-blog';

const LOCAL_BLOG_INDEX_LIMIT = 24;

function expectBlankLineBetween(
  markdown: string,
  before: string,
  after: string
): void {
  expect(markdown).toContain(`${before}\n\n${after}`);
}

describe('llms markdown blog builders', () => {
  it('builds a blog index with post markdown links', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey', slug: 'ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: 'How to choose a phone',
          slug: 'choose-a-phone',
          excerpt: 'Buyer guide',
          reading_time_minutes: 4,
        },
      ],
      ['Guides']
    );

    expect(result).toContain('# Ogabassey Blog');
    expect(result).toContain('> Latest published articles');
    expect(result).toContain('- Categories: Guides');
    expect(result).toContain('## Posts');
    expect(result).toContain('- [How to choose a phone]');
    expectBlankLineBetween(
      result,
      '# Ogabassey Blog',
      '> Latest published articles'
    );
    expectBlankLineBetween(result, '- Categories: Guides', '## Posts');
    expect(result).toContain('https://ogabassey.com/blog/choose-a-phone.md');
    expect(result).toContain('Guides');
  });

  it('builds a blog post markdown page from structured content', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'How to choose a phone',
        slug: 'choose-a-phone',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Structured buying advice' }],
            },
          ],
        },
        author_name: 'Editor',
        category: 'Guides',
      }
    );

    expect(result).toContain('# How to choose a phone');
    expect(result).toContain('> Structured buying advice');
    expect(result).toContain('## Summary');
    expectBlankLineBetween(result, '> Structured buying advice', '## Summary');
    expect(result).toContain('https://ogabassey.com/blog/choose-a-phone.md');
  });

  it('handles empty blog indexes without category output', () => {
    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey', slug: 'ogabassey' },
      'https://ogabassey.com',
      [],
      []
    );

    expect(result).toContain('# Ogabassey Blog');
    expect(result).toContain(
      '- Markdown mirror: https://ogabassey.com/blog/index.html.md'
    );
    expect(result).toContain('## Posts');
    expectBlankLineBetween(
      result,
      '- Markdown mirror: https://ogabassey.com/blog/index.html.md',
      '## Posts'
    );
    expect(result).not.toContain('- Categories:');
    expect(result).not.toContain('.md):');
  });

  it('limits blog index posts to the public preview count', () => {
    const posts = Array.from(
      { length: LOCAL_BLOG_INDEX_LIMIT + 1 },
      (_, index) => ({
        title: `Post ${index + 1}`,
        slug: `post-${index + 1}`,
      })
    );

    const result = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey', slug: 'ogabassey' },
      'https://ogabassey.com',
      posts,
      []
    );

    expect(result).toContain(
      `https://ogabassey.com/blog/post-${LOCAL_BLOG_INDEX_LIMIT}.md`
    );
    expect(result).not.toContain(
      `https://ogabassey.com/blog/post-${LOCAL_BLOG_INDEX_LIMIT + 1}.md`
    );
  });

  it('falls back when blog post content is not previewable', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Unpreviewable content',
        slug: 'unpreviewable-content',
        content: { foo: 'bar' },
      }
    );

    expect(result).toContain('> Read this post.');
    expect(result).toContain('## Summary');
    expectBlankLineBetween(result, '> Read this post.', '## Summary');
    expect(result).not.toContain('- Author:');
    expect(result).not.toContain('- Category:');
  });

  it('sanitizes merchant and blog-controlled markdown fields', () => {
    const index = buildBlogIndexMarkdown(
      { business_name: '<script>alert(1)</script>Bad **Store**', slug: 'bad' },
      'https://ogabassey.com',
      [
        {
          title: '[Injected](javascript:alert(1)) **Title**',
          slug: 'unsafe post +',
          excerpt: '<img src=x onerror=alert(1)> **Excerpt**',
        },
      ],
      ['[Guides](javascript:alert(1))']
    );
    const post = buildBlogPostMarkdown(
      { business_name: '<script>alert(1)</script>Bad **Store**' },
      'https://ogabassey.com',
      {
        title: '[Post](javascript:alert(1))',
        slug: 'post slug +',
        excerpt: '<b>Unsafe</b> **summary**',
        author_name: '[Editor](javascript:alert(1))',
        category: '<i>Guides</i>',
        tags: ['**Deals**', '[Phones](javascript:alert(1))'],
      }
    );

    expect(index).not.toContain('<script');
    expect(index).not.toContain('</script>');
    expect(index).not.toContain('<img');
    expect(index).not.toContain('<b>');
    expect(index).not.toContain('</b>');
    expect(index).not.toContain('<i>');
    expect(index).not.toContain('</i>');
    expect(index).not.toContain('javascript:');
    expect(index).not.toContain('**Store**');
    expect(index).not.toContain('**Title**');
    expect(index).not.toContain('**Excerpt**');
    expect(index).toContain('Bad');
    expect(index).toContain('Guides');

    expect(post).not.toContain('<script');
    expect(post).not.toContain('</script>');
    expect(post).not.toContain('<img');
    expect(post).not.toContain('<b>');
    expect(post).not.toContain('</b>');
    expect(post).not.toContain('<i>');
    expect(post).not.toContain('</i>');
    expect(post).not.toContain('javascript:');
    expect(post).not.toContain('**Store**');
    expect(post).not.toContain('**summary**');
    expect(post).not.toContain('**Deals**');
    expect(post).toContain('Bad');
    expect(post).toContain('Guides');

    expect(index).toContain('Title');
    expect(index).toContain('unsafe%20post%20%2B');
    expect(post).toContain('Unsafe');
    expect(post).toContain('post%20slug%20%2B');
  });

  it('sanitizes structured content previews before rendering markdown', () => {
    const result = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Structured Safety',
        slug: 'structured safety +',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '<script>alert(1)</script> Safe **summary** javascript:alert(1)',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '<img src=x onerror=alert(1)> text' },
              ],
            },
          ],
        },
      }
    );

    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script>');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('**summary**');
    expect(result).toContain('Safe');
    expect(result).toContain('summary');
    expect(result).toContain('text');
    expect(result).toContain('structured%20safety%20%2B');
  });

  it('uses fallbacks when sanitized blog preview text is empty', () => {
    const index = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey', slug: 'ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: 'Empty excerpt',
          slug: 'empty-excerpt',
          excerpt: '<b></b>',
        },
      ],
      []
    );
    const post = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Empty preview',
        slug: 'empty-preview',
        excerpt: '<b></b>',
      }
    );

    expect(index).toContain(
      '- [Empty excerpt](https://ogabassey.com/blog/empty-excerpt.md): Published blog post'
    );
    expect(post).toContain('> Read this post.');
  });

  it('only renders positive finite reading-time metadata', () => {
    const index = buildBlogIndexMarkdown(
      { business_name: 'Ogabassey', slug: 'ogabassey' },
      'https://ogabassey.com',
      [
        {
          title: 'Negative read',
          slug: 'negative-read',
          reading_time_minutes: -3,
        },
        {
          title: 'Zero read',
          slug: 'zero-read',
          reading_time_minutes: 0,
        },
        {
          title: 'NaN read',
          slug: 'nan-read',
          reading_time_minutes: Number.NaN,
        },
        {
          title: 'Infinite read',
          slug: 'infinite-read',
          reading_time_minutes: Number.POSITIVE_INFINITY,
        },
        {
          title: 'Valid read',
          slug: 'valid-read',
          reading_time_minutes: 5,
        },
      ],
      []
    );
    const post = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Invalid reading time',
        slug: 'invalid-reading-time',
        content: 'Readable content',
        reading_time_minutes: -3,
      }
    );
    const zeroReadingTimePost = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Zero reading time',
        slug: 'zero-reading-time',
        content: 'Readable content',
        reading_time_minutes: 0,
      }
    );
    const postWithReadingTime = buildBlogPostMarkdown(
      { business_name: 'Ogabassey' },
      'https://ogabassey.com',
      {
        title: 'Valid reading time',
        slug: 'valid-reading-time',
        content: 'Readable content',
        reading_time_minutes: 5,
      }
    );

    expect(index).not.toContain('-3 min read');
    expect(index).not.toContain('0 min read');
    expect(index).not.toContain('NaN min read');
    expect(index).not.toContain('Infinity min read');
    expect(index).toContain('(5 min read)');
    expect(post).not.toContain('- Reading time:');
    expect(zeroReadingTimePost).not.toContain('- Reading time:');
    expect(postWithReadingTime).toContain('- Reading time: 5 minutes');
  });
});
