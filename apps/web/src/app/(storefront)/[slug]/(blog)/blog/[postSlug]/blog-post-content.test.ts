import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBlogUrl,
  buildCanonicalBlogPostUrl,
  getBlogPostTextPreview,
  resolveBlogPostContent,
  transformImageTitlesToFigureCaptions,
  unescapeHtmlText,
  wrapTrustedCdnInlineImagesInPicture,
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

  it('normalizes internal TipTap links before structured rendering', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Shop the Galaxy A57',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://ogabassey.com/smartphones/samsung-galaxy-a57?srsltid=tracking',
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await resolveBlogPostContent(content, {
      baseUrl: 'https://ogabassey.com',
      merchantSlug: 'ogabassey',
    });

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Shop the Galaxy A57',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: '/smartphones/samsung-galaxy-a57',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(result.renderedContent)).not.toContain('nofollow');
    expect(JSON.stringify(content)).toContain('nofollow');
  });

  it('strips nofollow from external TipTap source links without removing safe rel tokens', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Samsung source',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.samsung.com/ng/support/specs',
                    target: '_blank',
                    rel: 'nofollow ugc noopener noreferrer',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await resolveBlogPostContent(content, {
      baseUrl: 'https://ogabassey.com',
      merchantSlug: 'ogabassey',
    });

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Samsung source',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.samsung.com/ng/support/specs',
                    target: '_blank',
                    rel: 'ugc noopener noreferrer',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(result.renderedContent)).not.toContain('nofollow');
  });

  it('removes the rel attribute from TipTap links when nofollow is the only token', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Source',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.apple.com/newsroom/',
                    rel: 'nofollow',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Source',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.apple.com/newsroom/',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses leading TipTap JSON when legacy HTML was appended after it', async () => {
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Shop the MacBook lineup',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'http://ogabassey.com',
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const content = `${JSON.stringify(structuredContent)}<p>Related reading: <a href="https://ogabassey.com/blog/macbook-guide">MacBook guide</a>.</p>`;

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Shop the MacBook lineup',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'http://ogabassey.com',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.legacyHtml).toBe('');
  });

  it('parses leading TipTap JSON with escaped quotes before legacy HTML', async () => {
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'He said "buy now" today' }],
        },
      ],
    };
    const content = `${JSON.stringify(structuredContent)}<p>Legacy suffix</p>`;

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual(structuredContent);
  });

  it('parses leading TipTap JSON with nested arrays and objects', async () => {
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Nested spec' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const content = `${JSON.stringify(structuredContent)}<p>Legacy suffix</p>`;

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual(structuredContent);
  });

  it('keeps JSON-looking bracket characters inside string values', async () => {
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Use {curly} and [square] marks' }],
        },
      ],
    };
    const content = `${JSON.stringify(structuredContent)}<p>Legacy suffix</p>`;

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(true);
    expect(result.renderedContent).toEqual(structuredContent);
  });

  it('falls back to legacy HTML when a leading JSON prefix is unbalanced', async () => {
    const content =
      '{"type":"doc","content":[{"type":"paragraph"}<p>Legacy fallback content</p>';

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Legacy fallback content');
  });

  it('falls back to legacy HTML when a leading JSON prefix is not a TipTap doc', async () => {
    const content =
      '{"type":"paragraph","content":[] }<p>Legacy fallback content</p>';

    const result = await resolveBlogPostContent(content);

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Legacy fallback content');
  });

  it('keeps legacy HTML on the sanitized legacy branch', async () => {
    const result = await resolveBlogPostContent('<p>Legacy content</p>');

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Legacy content');
  });

  it('transforms image title attributes into semantic figure captions', async () => {
    // Arrange
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="Camera sample" /></p>';

    // Act
    const result = await resolveBlogPostContent(html);

    // Assert
    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('<figure>');
    expect(result.legacyHtml).toContain(
      '<figcaption>Camera sample</figcaption>'
    );
    expect(result.legacyHtml).not.toContain('title=');
  });

  it('sanitizes caption text so image titles cannot inject markup', async () => {
    // Arrange
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="&lt;img src=x onerror=alert(1)&gt; caption" /></p>';

    // Act
    const result = await resolveBlogPostContent(html);

    // Assert
    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('<figcaption>');
    expect(result.legacyHtml).toContain('caption</figcaption>');
    expect(result.legacyHtml).not.toContain('<figcaption><img');
    expect(result.legacyHtml).not.toContain('onerror=');
    expect(result.legacyHtml).not.toContain('<script');
  });

  it('keeps existing rendering for images without title captions', async () => {
    // Arrange
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" alt="Original alt" /></p>';

    // Act
    const result = await resolveBlogPostContent(html);

    // Assert
    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('alt="Original alt"');
    expect(result.legacyHtml).not.toContain('<figcaption>');
  });

  it('normalizes legacy internal storefront links inside html content', async () => {
    const result = await resolveBlogPostContent(
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB?srsltid=test" rel="nofollow ugc">iPhone</a> <a href="https://www.ogabassey.com/category/product/615">Old product</a></p>',
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
    expect(result.legacyHtml).not.toContain('nofollow');
  });

  it('neutralizes malformed legacy hrefs before they remain oversized links', async () => {
    const result = await resolveBlogPostContent(
      '<p><a href="/smartphones%3Eogabassey%20smartphones%3C/a%3E%20catalog%20and%20compare%20live%20stock">Ogabassey smartphones</a></p>',
      {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      }
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('href="#"');
    expect(result.legacyHtml).toContain('>Ogabassey smartphones</a>');
    expect(result.legacyHtml).not.toContain('/smartphones%3Eogabassey');
    expect(result.legacyHtml).not.toContain('catalog%20and%20compare');
    expect(result.legacyHtml).not.toContain('catalog and compare live stock');
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
      '<p><img src="https://cdn.example.com/blog/2023/09/Apple-iPhone-15-Pro-lineup-color-lineup-230912.jpg" alt="" /></p>',
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
      '<p><img src="https://cdn.example.com/blog/2023/09/Apple-iPhone-15-Pro-lineup-color-lineup-230912.jpg" /></p>',
      {
        fallbackImageAlt: 'iPhone 15 Series Review',
      }
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain(
      'alt="Apple iPhone 15 Pro lineup color lineup 230912"'
    );
  });

  it('removes legacy OgaBassey CDN blog images that now 404 in crawls', async () => {
    const result = await resolveBlogPostContent(
      '<p>Before<img src="https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg" alt="Redmi 13">After</p>'
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain('Before');
    expect(result.legacyHtml).toContain('After');
    expect(result.legacyHtml).not.toContain('Redmi-13-4-768x960-1.jpg');
    expect(result.legacyHtml).not.toContain('<img');
  });

  it('removes standalone wrappers around legacy OgaBassey CDN images', async () => {
    const result = await resolveBlogPostContent(
      '<p><img src="https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg" alt="Redmi 13"></p><p>Kept copy</p>'
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).not.toContain('Redmi-13-4-768x960-1.jpg');
    expect(result.legacyHtml).not.toContain('<p></p>');
    expect(result.legacyHtml).not.toContain('<p> </p>');
    expect(result.legacyHtml).toContain('<p>Kept copy</p>');
  });

  it('removes image wrappers when srcset references legacy OgaBassey CDN images', async () => {
    const legacyImage =
      'https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg';
    const fallbackImage = 'https://cdn.example.com/fallback.jpg';
    const result = await resolveBlogPostContent(
      `<p><img src="${fallbackImage}" srcset="${legacyImage} 768w, ${fallbackImage} 1200w" alt="Mixed source"></p><p>Kept copy</p>`
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).not.toContain(legacyImage);
    expect(result.legacyHtml).not.toContain(fallbackImage);
    expect(result.legacyHtml).not.toContain('Mixed source');
    expect(result.legacyHtml).not.toContain('<p></p>');
    expect(result.legacyHtml).toContain('<p>Kept copy</p>');
  });

  it('preserves relative blog image paths for merchant content isolation', async () => {
    const result = await resolveBlogPostContent(
      '<p><img src="/blog/2024/06/Redmi-13-4-768x960-1.jpg" alt="Merchant Redmi 13"></p>'
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).toContain(
      'src="/blog/2024/06/Redmi-13-4-768x960-1.jpg"'
    );
    expect(result.legacyHtml).toContain('alt="Merchant Redmi 13"');
  });

  it('removes titled legacy CDN blog images before caption figures are created', async () => {
    const result = await resolveBlogPostContent(
      '<p><img src="https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg" title="Redmi launch image" alt="Redmi 13"></p>'
    );

    expect(result.isJson).toBe(false);
    expect(result.legacyHtml).not.toContain('Redmi-13-4-768x960-1.jpg');
    expect(result.legacyHtml).not.toContain('<figure');
    expect(result.legacyHtml).not.toContain('<figcaption>');
    expect(result.legacyHtml).not.toContain('Redmi launch image');
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

describe('transformImageTitlesToFigureCaptions', () => {
  it('converts image titles into figure/figcaption markup', () => {
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="Camera sample" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(
      '<figure><img src="https://cdn.example.com/photo.jpg" /><figcaption>Camera sample</figcaption></figure>'
    );
  });

  it('does not wrap inline images inside text paragraphs', () => {
    const html =
      '<p>Intro <img src="https://cdn.example.com/photo.jpg" title="Inline caption" /> outro</p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(html);
  });

  it('converts titled image-only paragraphs with attributes', () => {
    const html =
      '<p id="hero-image" class="image-block"><img src="https://cdn.example.com/photo.jpg" title="Camera sample" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(
      '<figure id="hero-image" class="image-block"><img src="https://cdn.example.com/photo.jpg" /><figcaption>Camera sample</figcaption></figure>'
    );
  });

  it('converts titled image-only figure wrappers without nesting figures', () => {
    const html =
      '<figure class="legacy-figure"><img src="https://cdn.example.com/photo.jpg" title="Camera sample" /></figure>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(
      '<figure class="legacy-figure"><img src="https://cdn.example.com/photo.jpg" /><figcaption>Camera sample</figcaption></figure>'
    );
  });

  it('converts standalone titled image tags without paragraph wrappers', () => {
    const html =
      '<img src="https://cdn.example.com/photo.jpg" title="Camera sample" />';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(
      '<figure><img src="https://cdn.example.com/photo.jpg" /><figcaption>Camera sample</figcaption></figure>'
    );
  });

  it('converts standalone titled images inside non-paragraph wrappers', () => {
    const html =
      '<div><img src="https://cdn.example.com/photo.jpg" title="Camera sample" /></div>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(
      '<div><figure><img src="https://cdn.example.com/photo.jpg" /><figcaption>Camera sample</figcaption></figure></div>'
    );
  });

  it('does not wrap images inside inline-only wrappers', () => {
    const html =
      '<span><img src="https://cdn.example.com/photo.jpg" title="Inline caption" /></span>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(html);
  });

  it('keeps image tags without title unchanged', () => {
    const html = '<p><img src="https://cdn.example.com/photo.jpg" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(html);
  });

  it('escapes untrusted caption text', () => {
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="&lt;script&gt;alert(1)&lt;/script&gt; &amp; promo" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toContain(
      '<figcaption>&lt;script&gt;alert(1)&lt;/script&gt; &amp; promo</figcaption>'
    );
    expect(result).not.toContain('<figcaption><script>');
  });

  it('decodes common typographic caption entities before escaping text', () => {
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="&copy; Baci &mdash; 2026" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toContain(
      `<figcaption>${'\u00a9'} Baci ${'\u2014'} 2026</figcaption>`
    );
    expect(result).not.toContain('&amp;copy;');
    expect(result).not.toContain('&amp;mdash;');
  });

  it('leaves empty or whitespace-only titles unchanged', () => {
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="   " /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(html);
  });

  it('handles multiple images in one string', () => {
    const html =
      '<p><img src="https://cdn.example.com/a.jpg" title="A" /></p><p><img src="https://cdn.example.com/b.jpg" title="B" /></p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toContain('<figcaption>A</figcaption>');
    expect(result).toContain('<figcaption>B</figcaption>');
  });

  it('does not modify malformed img tags that do not close', () => {
    const html =
      '<p><img src="https://cdn.example.com/photo.jpg" title="Broken"</p>';

    const result = transformImageTitlesToFigureCaptions(html);

    expect(result).toBe(html);
  });
});

describe('unescapeHtmlText', () => {
  it('unescapes known html entities', () => {
    expect(unescapeHtmlText('&amp;amp;')).toBe('&amp;');
    expect(unescapeHtmlText('&amp;lt;')).toBe('&lt;');
    expect(unescapeHtmlText('&amp;gt;')).toBe('&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(unescapeHtmlText('')).toBe('');
  });

  it('preserves unknown entities and surrounding text', () => {
    expect(unescapeHtmlText('Price &notareal; 2026')).toBe(
      'Price &notareal; 2026'
    );
  });

  it('unescapes common typographic html entities', () => {
    expect(unescapeHtmlText('&copy; &mdash; &ndash;')).toBe(
      '\u00a9 \u2014 \u2013'
    );
  });

  it('handles nested and incomplete entities without throwing', () => {
    expect(unescapeHtmlText('&amp;amp;lt;')).toBe('&amp;lt;');
    expect(unescapeHtmlText('&amp;amp')).toBe('&amp');
  });

  it('is a no-op for plain text without entities', () => {
    expect(unescapeHtmlText('No entities here')).toBe('No entities here');
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

describe('wrapTrustedCdnInlineImagesInPicture', () => {
  const CDN =
    'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png';
  const LEGACY_INLINE =
    'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/x/inline-1.png';

  it('wraps trusted CDN inline images in <picture> with avif/webp sources', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="Speaker" />`
    );

    expect(out).toContain('<picture>');
    expect(out).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.avif 384w'
    );
    expect(out).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.webp 384w'
    );
    expect(out).toContain(
      'sizes="(max-width: 768px) calc(100vw - 3rem), 800px"'
    );
    // The original asset stays as fallback but gets responsive width candidates.
    expect(out).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png 384w'
    );
    expect(out).not.toContain('width="1200"');
    expect(out).not.toContain('height="675"');
    expect(out).toContain(`data-original-src="${CDN}"`);

    expect(out).toContain('loading="eager"');
    expect(out).toContain('decoding="sync"');
    expect(out).toContain('fetchpriority="high"');
  });

  it('preserves trusted inline image dimensions from the source HTML', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" width="900" height="1200" alt="Portrait" />`
    );

    expect(out).toContain('width="900"');
    expect(out).toContain('height="1200"');
    expect(out).toContain('alt="Portrait"');
  });

  it('lazy-loads later optimized legacy body images', () => {
    const secondCdn = CDN.replace(
      'inline-1-b9244d7a754d',
      'inline-2-b9244d7a754d'
    );
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="First" /><img src="${secondCdn}" alt="Second" />`
    );

    expect(out).toContain('alt="First"');
    expect(out).toContain('loading="eager"');
    expect(out).toContain('fetchpriority="high"');
    expect(out).toContain('alt="Second"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
  });

  it('prioritizes the first surviving inline image after removing legacy CDN blog images', () => {
    const legacyImage =
      'https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg';
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${legacyImage}" alt="Removed" /><img src="${CDN}" alt="Survivor" />`
    );

    expect(out).not.toContain(legacyImage);
    expect(out).not.toContain('alt="Removed"');
    expect(out).toContain('alt="Survivor"');
    expect(out).toContain('loading="eager"');
    expect(out).toContain('decoding="sync"');
    expect(out).toContain('fetchpriority="high"');
  });

  it('removes inline images when srcset references legacy CDN blog images', () => {
    const legacyImage =
      'https://cdn.ogabassey.com/blog/2024/06/Redmi-13-4-768x960-1.jpg';
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" srcset="${legacyImage} 768w, ${CDN} 1200w" alt="Mixed source" />`
    );

    expect(out).toBe('');
  });

  it('does not prioritize legacy body images when a featured hero is already rendered', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="First" />`,
      { prioritizeFirstBodyImage: false }
    );

    expect(out).toContain('alt="First"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).not.toContain('fetchpriority="high"');
  });
  it('strips stale high fetch priority from lazy rebuilt body images', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="First" fetchpriority="high" />`,
      { prioritizeFirstBodyImage: false }
    );

    expect(out).toContain('alt="First"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).not.toContain('fetchpriority="high"');
  });

  it('does not prioritize a trusted CDN image after an earlier body image', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="https://example.com/hero.jpg" alt="External" /><img src="${CDN}" alt="Trusted" />`
    );

    expect(out).toContain('alt="External"');
    expect(out).toContain('alt="Trusted"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).not.toContain('fetchpriority="high"');
  });

  it('leaves external and already-optimized featured images untouched', () => {
    const external = '<img src="https://example.com/inline-1.png" alt="x" />';
    expect(wrapTrustedCdnInlineImagesInPicture(external)).toBe(external);

    const featured =
      '<img src="https://cdn.ogabassey.com/core-assets/blog/x/landscape_16x9.jpg" alt="x" />';
    expect(wrapTrustedCdnInlineImagesInPicture(featured)).toBe(featured);
  });

  it('leaves legacy inline images without generated sibling markers untouched', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${LEGACY_INLINE}" alt="Speaker" />`
    );

    expect(out).toBe(`<img src="${LEGACY_INLINE}" alt="Speaker" />`);
  });

  it('wraps an inline image even when alt text contains a literal ">"', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${CDN}" alt="value a > b" />`
    );

    expect(out).toContain('<picture>');
    expect(out).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.avif'
    );
    expect(out).toContain('alt="value a > b"');
    expect(out).toContain(
      'width=828,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png'
    );
  });

  it('does not wrap trusted CDN inline images that are already inside a picture', () => {
    const html = `<picture><source srcset="${CDN}.webp" type="image/webp" /><img src="${CDN}" alt="Speaker" /></picture>`;

    const out = wrapTrustedCdnInlineImagesInPicture(html);

    expect(out).toBe(html);
    expect(out.match(/<picture>/g)).toHaveLength(1);
  });

  it('does not treat data-src or quoted text as the real src attribute', () => {
    const dataSrcOnly = `<img data-src="${CDN}" alt="Speaker" />`;
    expect(wrapTrustedCdnInlineImagesInPicture(dataSrcOnly)).toBe(dataSrcOnly);

    const srcInAlt = `<img src="https://example.com/fallback.png" alt="code sample src='${CDN}'" />`;
    expect(wrapTrustedCdnInlineImagesInPicture(srcInAlt)).toBe(srcInAlt);
  });

  it('preserves quoted text that looks like replaced attributes', () => {
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img alt="notes src=text width=12 srcset=demo" src="${CDN}" />`
    );

    expect(out).toContain('alt="notes src=text width=12 srcset=demo"');
    expect(out).toContain('src="https://cdn.ogabassey.com/image/width=828');
    expect(out).toContain('srcset="https://cdn.ogabassey.com/image/width=384');
  });

  it('does not double-escape ampersands already escaped by the sanitizer', () => {
    // src is captured from sanitized HTML, so `&` is already `&amp;`.
    const src = `${CDN}?v=1&amp;x=2`;
    const out = wrapTrustedCdnInlineImagesInPicture(
      `<img src="${src}" alt="x" />`
    );

    expect(out).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.avif?v=1&amp;x=2'
    );
    expect(out).not.toContain('&amp;amp;');
  });
});
