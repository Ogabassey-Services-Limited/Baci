import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBlogUrl,
  buildCanonicalBlogPostUrl,
  getBlogPostTextPreview,
  resolveBlogPostContent,
} from './blog-post-content';

describe('resolveBlogPostContent', () => {
  it('preserves TipTap JSON documents for structured rendering', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Structured content' }],
        },
      ],
    };

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual(content);
    expect(result.legacyHtml).toBe('');
  });

  it('parses stringified TipTap JSON documents for structured rendering', async () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Structured content string' }],
        },
      ],
    });

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual(JSON.parse(content));
    expect(result.legacyHtml).toBe('');
  });

  it('keeps legacy HTML on the sanitized legacy branch', async () => {
    const result = await resolveBlogPostContent('<p>Legacy content</p>');

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Legacy content');
  });

  it('normalizes legacy internal storefront links inside html content', async () => {
    const result = await resolveBlogPostContent(
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB?srsltid=test">iPhone</a> <a href="https://www.ogabassey.com/category/product/615">Old product</a></p>',
      {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      }
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain(
      'href="/smartphones/iphone-13-pro-6gb-256gb"'
    );
    expect(result.legacyHtml).toContain('href="/products"');
  });

  it('renders markdown into sanitized legacy HTML', async () => {
    const result = await resolveBlogPostContent('## Markdown title');

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Markdown title');
  });

  it('preserves author-supplied alt="" for decorative images (WCAG)', async () => {
    // WCAG allows `alt=""` as a deliberate signal that an image is decorative
    // and should be ignored by assistive tech. Respect that author signal
    // instead of overwriting it with a derived fallback.
    const result = await resolveBlogPostContent(
      '<p><img src="https://cdn.ogabassey.com/blog/2023/09/Apple-iPhone-15-Pro-lineup-color-lineup-230912.jpg" alt="" /></p>',
      {
        fallbackImageAlt: 'iPhone 15 Series Review',
      }
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('alt=""');
    expect(result.legacyHtml).not.toContain('Apple iPhone 15 Pro');
  });

  it('injects filename-derived alt text when alt attribute is absent', async () => {
    const result = await resolveBlogPostContent(
      '<p><img src="https://cdn.ogabassey.com/blog/2023/09/Apple-iPhone-15-Pro-lineup-color-lineup-230912.jpg" /></p>',
      {
        fallbackImageAlt: 'iPhone 15 Series Review',
      }
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain(
      'alt="Apple iPhone 15 Pro lineup color lineup 230912"'
    );
  });

  it('injects missing legacy image alt text using the fallback title', async () => {
    const result = await resolveBlogPostContent('<p><img /></p>', {
      fallbackImageAlt: 'Galaxy Unpacked July 2025',
    });

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('alt="Galaxy Unpacked July 2025"');
  });

  it('escapes HTML entities in injected alt text for accessibility', async () => {
    const result = await resolveBlogPostContent('<p><img /></p>', {
      fallbackImageAlt: "What's New & Notable",
    });

    expect(result.isJson).toBe(false);
    // Must be rendered as HTML entities (not JSON \uXXXX escapes).
    expect(result.legacyHtml).toContain('alt="What&#39;s New &amp; Notable"');
    expect(result.legacyHtml).not.toContain('\\u0027');
    expect(result.legacyHtml).not.toContain('\\u0026');
  });

  it('handles empty and null content safely', async () => {
    const emptyResult = await resolveBlogPostContent('');
    const nullResult = await resolveBlogPostContent(null);

    expect(emptyResult.isJson).toBe(false);
    expect(emptyResult.legacyHtml).toBe('');
    expect(nullResult.isJson).toBe(false);
    expect(nullResult.legacyHtml).toBe('');
  });
});

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

  it('falls back for empty strings', () => {
    const preview = getBlogPostTextPreview('');

    expect(preview).toBe('Read this blog post');
  });

  it('concatenates nested TipTap paragraphs', () => {
    const preview = getBlogPostTextPreview({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Nested second paragraph' }],
            },
          ],
        },
      ],
    });

    expect(preview).toBe('First paragraph Nested second paragraph');
  });
});

describe('buildCanonicalBlogPostUrl', () => {
  it('uses subdomain canonical URL without doubling the slug', () => {
    expect(
      buildCanonicalBlogPostUrl(
        { slug: 'ogabassey', custom_domain: undefined },
        'my-post'
      )
    ).toBe('https://ogabassey.usebaci.com/blog/my-post');
  });

  it('uses the merchant custom domain when present', () => {
    expect(
      buildCanonicalBlogPostUrl(
        { slug: 'ogabassey', custom_domain: 'ogabassey.com' },
        'my-post'
      )
    ).toBe('https://ogabassey.com/blog/my-post');
  });

  describe('development mode', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns dev URL with slug baked in during development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(
        buildCanonicalBlogPostUrl(
          { slug: 'ogabassey', custom_domain: undefined },
          'my-post'
        )
      ).toBe('http://localhost:3000/ogabassey/blog/my-post');
    });
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

  it('normalizes trailing slashes in merchant base paths', () => {
    expect(buildBlogUrl('https://usebaci.com', '/ogabassey/', 'post-1')).toBe(
      'https://usebaci.com/ogabassey/blog/post-1'
    );
  });

  it('normalizes repeated trailing slashes for blog index urls', () => {
    expect(buildBlogUrl('https://usebaci.com', '/ogabassey///')).toBe(
      'https://usebaci.com/ogabassey/blog'
    );
  });
});
