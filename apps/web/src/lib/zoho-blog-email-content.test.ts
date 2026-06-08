import { describe, expect, it } from 'vitest';
import { buildZohoBlogEmailHtml } from './zoho-blog-email-content';

describe('buildZohoBlogEmailHtml', () => {
  it('renders a safe email HTML shell for a blog post', () => {
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'https://ogabassey.com/blog/infinix-hot-70',
      brand: { brandColor: '#0f766e', brandName: 'Oga Gadgets' },
      post: {
        category: '<script>alert(1)</script>Smartphones',
        content: '<p>Fallback body</p>',
        excerpt: '<strong>Launch</strong> details & pricing',
        featured_image_alt: 'Hot 70 "hero"',
        featured_image_url: 'https://cdn.ogabassey.com/hot70.jpg',
        title: 'Infinix <Hot 70>',
      },
    });

    expect(html).toContain(
      '<h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#111827;">Infinix &lt;Hot 70&gt;</h1>'
    );
    expect(html).toContain('Launch details &amp; pricing');
    expect(html).toContain('Oga Gadgets Smartphones');
    expect(html).toContain('background:#0f766e');
    expect(html).toContain('href="https://ogabassey.com/blog/infinix-hot-70"');
    expect(html).not.toContain('<script>');
  });

  it('omits the image block when no featured image URL is available', () => {
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'https://ogabassey.com/blog/new-post',
      post: {
        category: 'Smartphones',
        content: 'Body',
        excerpt: 'Preview',
        featured_image_url: null,
        title: 'New post',
      },
    });

    expect(html).not.toContain('<img ');
  });

  it('uses safe fallbacks for empty title and category fields', () => {
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'https://ogabassey.com/blog/new-post',
      post: {
        category: '   ',
        content: '',
        excerpt: '',
        title: '',
      },
    });

    expect(html).toContain('New Store Updates article');
    expect(html).toContain('Store Updates Tech');
  });

  it('truncates long preview text to 240 characters', () => {
    const longExcerpt = `${'A'.repeat(240)}extra text`;
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'https://ogabassey.com/blog/new-post',
      post: {
        category: 'Smartphones',
        content: 'Body',
        excerpt: longExcerpt,
        title: 'New post',
      },
    });

    expect(html).toContain('A'.repeat(240));
    expect(html).not.toContain('extra text');
  });

  it('falls back to content when excerpt is missing', () => {
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'https://ogabassey.com/blog/new-post',
      post: {
        category: 'Smartphones',
        content: '<p>Fallback body from content</p>',
        excerpt: null,
        title: 'New post',
      },
    });

    expect(html).toContain('Fallback body from content');
  });

  it('falls back to a safe CTA URL when blogUrl is invalid', () => {
    const html = buildZohoBlogEmailHtml({
      blogUrl: 'javascript:alert(1)',
      post: {
        category: 'Smartphones',
        content: 'Body',
        excerpt: 'Preview',
        title: 'New post',
      },
    });

    expect(html).toContain('href="https://usebaci.com/blog"');
    expect(html).not.toContain('javascript:alert');
  });
});
