import { describe, expect, it } from 'vitest';
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  sanitizeHtml,
  sanitizeSvg,
} from '@/lib/sanitize';

describe('sanitize', () => {
  it('removes unsafe scripts and javascript URLs from HTML', () => {
    const input =
      '<p>Hello</p><script>alert(1)</script><a href="javascript:alert(1)">Click</a>';

    const output = sanitizeHtml(input);

    expect(output).toContain('<p>Hello</p>');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('javascript:');
  });

  it('does not rehydrate markup wrapped in disallowed xmp raw text', () => {
    const output = sanitizeHtml(
      '<xmp><img src=x onerror=alert(1)><script>alert(1)</script></xmp>'
    );

    expect(output).toBe('');
    expect(output).not.toContain('<img');
    expect(output).not.toContain('onerror=');
    expect(output).not.toContain('<script');
  });

  it('strips disallowed raw text blocks while preserving adjacent allowed HTML', () => {
    const output = sanitizeHtml(
      '<p>Before</p><script>alert(1)</script><strong>Keep</strong><textarea><img src=x onerror=alert(1)></textarea><a href="https://example.com">Link</a>'
    );

    expect(output).toBe(
      '<p>Before</p><strong>Keep</strong><a href="https://example.com" rel="noopener noreferrer">Link</a>'
    );
  });

  it('strips multiple raw text blocks without dropping nested allowed neighbors', () => {
    const output = sanitizeHtml(
      '<div><p>Intro <strong>safe</strong></p><style>.x{color:red}</style><p>Middle</p><script><p>unsafe</p></script><p><a href="https://example.com">Outro</a></p></div>'
    );

    expect(output).toBe(
      '<div><p>Intro <strong>safe</strong></p><p>Middle</p><p><a href="https://example.com" rel="noopener noreferrer">Outro</a></p></div>'
    );
  });

  it('keeps safe links and adds rel protection', () => {
    const output = sanitizeHtml('<a href="https://example.com">Safe</a>');

    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('rel="noopener noreferrer"');
  });

  it('preserves lowlight code span classes while stripping active attributes', () => {
    const output = sanitizeHtml(
      '<code class="language-js"><span class="hljs-keyword" style="color:red" onclick="alert(1)">const</span></code>'
    );

    expect(output).toContain('<code class="language-js">');
    expect(output).toContain('<span class="hljs-keyword">const</span>');
    expect(output).not.toContain('style=');
    expect(output).not.toContain('onclick=');
  });

  it('preserves semantic figure and figcaption markup', () => {
    const output = sanitizeHtml(
      '<figure><img src="https://example.com/photo.jpg" alt="Camera"><figcaption>Camera sample</figcaption></figure>'
    );

    expect(output).toContain('<figure>');
    expect(output).toContain('<figcaption>Camera sample</figcaption>');
  });

  it('strips stale fetchpriority from generic sanitized images', () => {
    const output = sanitizeHtml(
      '<img src="https://example.com/body.jpg" alt="Body" fetchpriority="high">'
    );

    expect(output).toContain('<img');
    expect(output).not.toContain('fetchpriority=');
  });

  it('forces below-fold images to lazy loading when requested', () => {
    const output = sanitizeHtml(
      '<img src="https://example.com/body.jpg" alt="Body" loading="eager">',
      { forceLazyImages: true }
    );

    expect(output).toContain('loading="lazy"');
    expect(output).toContain('decoding="async"');
    expect(output).not.toContain('loading="eager"');
  });

  it('keeps fetchpriority only for internally trusted priority blog images', () => {
    const priorityImageSource =
      'https://cdn.ogabassey.com/core-assets/blog/x/inline-1-b9244d7a754d.png';

    const output = sanitizeHtml(
      `<img src="${priorityImageSource}" alt="Hero" data-baci-priority-image="true" fetchpriority="high">`,
      { trustedPriorityImageSources: [priorityImageSource] }
    );

    expect(output).toContain('fetchpriority="high"');
    expect(output).not.toContain('data-baci-priority-image');
  });

  it('strips user-supplied priority markers from dirty images', () => {
    const output = sanitizeHtml(
      '<img src="https://cdn.ogabassey.com/core-assets/blog/x/inline-1-b9244d7a754d.png" alt="Hero" data-baci-priority-image="true" fetchpriority="high">'
    );

    expect(output).not.toContain('fetchpriority=');
    expect(output).not.toContain('data-baci-priority-image');
  });

  it('sanitizes unsafe caption markup while keeping figcaption', () => {
    const output = sanitizeHtml(
      '<figure><img src="https://example.com/photo.jpg"><figcaption><img src=x onerror=alert(1)>Caption<script>alert(1)</script></figcaption></figure>'
    );

    expect(output).toContain('<figcaption>');
    expect(output).toContain('Caption');
    expect(output).not.toContain('onerror=');
    expect(output).not.toContain('<script');
  });

  it('coerces heading offsets to safe finite integers', () => {
    expect(
      sanitizeHtml('<h1>Title</h1>', { headingLevelOffset: 1.9 })
    ).toContain('<h2>Title</h2>');
    expect(
      sanitizeHtml('<h1>Title</h1>', {
        headingLevelOffset: Number.POSITIVE_INFINITY,
      })
    ).toContain('<h1>Title</h1>');
  });

  it('removes empty anchors when SEO anchor normalization is enabled', () => {
    const output = sanitizeHtml(
      '<p>See <a href="https://example.com/phone"></a> details.</p>',
      { normalizeSeoAnchors: true }
    );

    expect(output).toBe('<p>See  details.</p>');
    expect(output).not.toContain('<a');
  });

  it('unwraps empty linked images when SEO anchor normalization is enabled', () => {
    const output = sanitizeHtml(
      '<p><a href="https://example.com/photo"><img src="https://example.com/photo.jpg" alt="Product photo"></a></p>',
      { normalizeSeoAnchors: true }
    );

    expect(output).toBe(
      '<p><img src="https://example.com/photo.jpg" alt="Product photo" /></p>'
    );
    expect(output).not.toContain('<a');
  });

  it('keeps legitimate resource links when SEO anchor normalization is enabled', () => {
    const output = sanitizeHtml(
      '<p>Source: <a href="https://example.com/assets/specs.json">Product data JSON</a> and <a href="https://example.com/app.js">App JS</a>.</p>',
      { normalizeSeoAnchors: true }
    );

    expect(output).toBe(
      '<p>Source: <a href="https://example.com/assets/specs.json" rel="noopener noreferrer">Product data JSON</a> and <a href="https://example.com/app.js" rel="noopener noreferrer">App JS</a>.</p>'
    );
  });

  it('keeps labels but removes Next image optimizer links when SEO anchor normalization is enabled', () => {
    const output = sanitizeHtml(
      '<p><a href="/_next/image?url=https%3A%2F%2Fapi.example.com%2Fproduct.avif&w=128&q=75">Samsung Galaxy Watch 6 Classic</a></p>',
      { normalizeSeoAnchors: true }
    );

    expect(output).toBe('<p>Samsung Galaxy Watch 6 Classic</p>');
    expect(output).not.toContain('/_next/image');
  });

  it('strips hrefs that accidentally include serialized anchor attributes', () => {
    const output = sanitizeHtml(
      '<p><a href="http://ogabassey.com%22,%22target%22:%22_blank%22,%22rel%22:%22noopener">our store</a></p>',
      { normalizeSeoAnchors: true }
    );

    expect(output).toBe('<p><a rel="noopener noreferrer">our store</a></p>');
    expect(output).not.toContain('ogabassey.com%22');
    expect(output).not.toContain('target=');
  });

  it('strips serialized anchor attribute leaks with default sanitizer options', () => {
    const output = sanitizeHtml(
      '<p><a href="http://ogabassey.com%22,%22target%22:%22_blank%22,%22rel%22:%22noopener">our store</a></p>'
    );

    expect(output).toBe('<p><a rel="noopener noreferrer">our store</a></p>');
    expect(output).not.toContain('ogabassey.com%22');
    expect(output).not.toContain('target=');
  });

  it('strips double-encoded serialized anchor attribute leaks', () => {
    const output = sanitizeHtml(
      '<p><a href="http://ogabassey.com%2522%252C%2522target%2522%253A%2522_blank%2522">our store</a></p>'
    );

    expect(output).toBe('<p><a rel="noopener noreferrer">our store</a></p>');
    expect(output).not.toContain('%2522');
    expect(output).not.toContain('target=');
  });

  it('keeps legitimate URLs when serialized-looking text is only in the query', () => {
    const output = sanitizeHtml(
      '<p><a href="https://ogabassey.com/search?q=%22,%22target%22">Search</a></p>'
    );

    expect(output).toBe(
      '<p><a href="https://ogabassey.com/search?q=%22,%22target%22" rel="noopener noreferrer">Search</a></p>'
    );
  });

  it('removes active content from SVG', () => {
    const input =
      '<svg viewBox="0 0 16 16" onload="alert(1)"><script>alert(1)</script><circle cx="8" cy="8" r="6" /></svg>';

    const output = sanitizeSvg(input);

    expect(output).toContain('<circle');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('onload=');
  });

  it('preserves case-sensitive SVG attributes', () => {
    const output = sanitizeSvg(
      '<svg viewBox="0 0 32 32"><path d="M0 0h32v32H0z" /></svg>'
    );

    expect(output).toContain('viewBox="0 0 32 32"');
  });

  it('escapes plain text without dropping literal angle-bracket content', () => {
    const output = escapeHtmlText('TGW <Store> & "quotes"');

    expect(output).toBe('TGW &lt;Store&gt; &amp; "quotes"');
  });

  it('preserves single quotes and escapes angle brackets in plain text content', () => {
    const output = escapeHtmlText("Baci's <Store>");

    expect(output).toBe("Baci's &lt;Store&gt;");
  });

  it('escapes quotes for safe HTML attribute interpolation', () => {
    const output = escapeHtmlAttribute(`"Baci's" & <Store>`);

    expect(output).toBe('&quot;Baci&#39;s&quot; &amp; &lt;Store&gt;');
  });

  it('keeps <picture>/<source> for responsive blog inline images', () => {
    const input =
      '<picture><source srcset="https://cdn.ogabassey.com/x/inline-1.png.avif" type="image/avif" /><source srcset="https://cdn.ogabassey.com/x/inline-1.png.webp" type="image/webp" /><img src="https://cdn.ogabassey.com/x/inline-1.png" srcset="https://cdn.ogabassey.com/x/inline-1.png 384w" sizes="(max-width: 768px) 100vw, 800px" data-baci-priority-image="true" fetchpriority="high" alt="speaker" /></picture>';

    const output = sanitizeHtml(input, {
      trustedPriorityImageSources: ['https://cdn.ogabassey.com/x/inline-1.png'],
    });

    expect(output).toContain('<picture>');
    expect(output).toContain('type="image/avif"');
    expect(output).toContain(
      'srcset="https://cdn.ogabassey.com/x/inline-1.png.avif"'
    );
    expect(output).toContain('<img');
    expect(output).toContain(
      'srcset="https://cdn.ogabassey.com/x/inline-1.png 384w"'
    );
    expect(output).toContain('sizes="(max-width: 768px) 100vw, 800px"');
    expect(output).toContain('fetchpriority="high"');
    expect(output).not.toContain('data-baci-priority-image');
  });

  it('still strips event handlers and scripts from media tags', () => {
    const output = sanitizeHtml(
      '<picture><source srcset="x" onload="alert(1)" /><img src="x" onerror="alert(1)" /></picture><script>alert(1)</script>'
    );

    expect(output).not.toContain('onload');
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('<script');
  });
});
