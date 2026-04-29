import { describe, expect, it } from 'vitest';
import {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
} from './llms-markdown-blog';

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
});
