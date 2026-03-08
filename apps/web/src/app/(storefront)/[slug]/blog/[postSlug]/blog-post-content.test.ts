import { describe, expect, it } from 'vitest';
import { buildBlogUrl, getBlogPostTextPreview } from './blog-post-content';

describe('getBlogPostTextPreview', () => {
  it('extracts plain text from TipTap JSON strings', () => {
    const preview = getBlogPostTextPreview(
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello structured blog world' }],
          },
        ],
      })
    );

    expect(preview).toBe('Hello structured blog world');
  });

  it('falls back safely when the content is not extractable', () => {
    const preview = getBlogPostTextPreview({ foo: 'bar' });

    expect(preview).toBe('Read this blog post');
  });
});

describe('buildBlogUrl', () => {
  it('preserves merchant base paths for subpath storefronts', () => {
    expect(buildBlogUrl('https://usebaci.com', '/ogabassey', 'post-1')).toBe(
      'https://usebaci.com/ogabassey/blog/post-1'
    );
  });

  it('omits the base path for custom-domain storefronts', () => {
    expect(buildBlogUrl('https://ogabassey.com', '', 'post-1')).toBe(
      'https://ogabassey.com/blog/post-1'
    );
  });
});
