import { describe, expect, it } from 'vitest';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';

describe('rewriteHtmlStorefrontHrefs', () => {
  it('rewrites internal anchors inside legacy html strings', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB">iPhone</a> <a href="https://www.ogabassey.com/category/product/615">Old product</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      '<p><a href="/smartphones/iphone-13-pro-6gb-256gb">iPhone</a> <a href="/products">Old product</a></p>'
    );
  });

  it('rewrites single-quoted legacy anchors too', () => {
    const html =
      "<p><a href='https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB'>iPhone</a> <a href='https://www.ogabassey.com/category/product/615'>Old product</a></p>";

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      "<p><a href='/smartphones/iphone-13-pro-6gb-256gb'>iPhone</a> <a href='/products'>Old product</a></p>"
    );
  });

  it('rewrites href attributes regardless of case or spacing', () => {
    const html =
      '<p><a HREF = "https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB">iPhone</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('<p><a href="/smartphones/iphone-13-pro-6gb-256gb">iPhone</a></p>');
  });

  it('returns html unchanged when there are no href attributes to rewrite', () => {
    expect(
      rewriteHtmlStorefrontHrefs('', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('');

    expect(
      rewriteHtmlStorefrontHrefs('<a>link</a>', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('<a>link</a>');
  });

  it('neutralizes malformed internal hrefs that swallowed article body text', () => {
    const html =
      '<p><a href="/smartphones%3Eogabassey%20smartphones%3C/a%3E%20catalog%20and%20compare%20live%20stock">Broken link</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('<p><a href="#">Broken link</a></p>');
  });

  it('leaves external and non-http href values unchanged', () => {
    const html =
      '<p><a href="https://example.com/phones/iphone">External</a> <a href="mailto:hello@example.com">Mail</a> <a href="tel:+2348000000000">Call</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(html);
  });

  it('escapes normalized href attribute values before reinserting them into HTML', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iphone-15?ref=nav&color=black">iPhone</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      '<p><a href="/smartphones/iphone-15?ref=nav&amp;color=black">iPhone</a></p>'
    );
  });

  it('neutralizes dangerous javascript hrefs during rewriting', () => {
    const html = '<p><a href="javascript:alert(1)">Unsafe</a></p>';

    expect(rewriteHtmlStorefrontHrefs(html)).toBe(
      '<p><a href="#">Unsafe</a></p>'
    );
  });
  it('preserves query parameters and fragments on rewritten internal hrefs', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB?utm_source=ig&color=blue#specs">iPhone</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      '<p><a href="/smartphones/iphone-13-pro-6gb-256gb?color=blue#specs">iPhone</a></p>'
    );
  });

  it('does not double-encode already-escaped href attribute values', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iphone-15?ref=nav&amp;color=black">iPhone</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      '<p><a href="/smartphones/iphone-15?ref=nav&amp;color=black">iPhone</a></p>'
    );
  });

  it('prepends non-empty base paths to rewritten internal hrefs', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB">iPhone</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '/store',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe(
      '<p><a href="/store/smartphones/iphone-13-pro-6gb-256gb">iPhone</a></p>'
    );
  });

  it('normalizes unquoted absolute same-site hrefs and re-emits them quoted', () => {
    const html =
      '<p><a href=https://ogabassey.com/blog/draft-post>Post</a> and <a href=/phones/iphone-15>Phone</a></p>';

    const result = rewriteHtmlStorefrontHrefs(html, {
      baseUrl: 'https://ogabassey.com',
      merchantSlug: 'ogabassey',
    });

    expect(result).toContain('href="/blog/draft-post"');
    expect(result).toContain('href="/smartphones/iphone-15"');
    expect(result).not.toContain('href=https://');
  });

  it('leaves quoted hrefs untouched by the unquoted pass', () => {
    const html = '<a href="/blog/kept-post">Kept</a>';

    const result = rewriteHtmlStorefrontHrefs(html, {
      baseUrl: 'https://ogabassey.com',
      merchantSlug: 'ogabassey',
    });

    expect(result).toBe('<a href="/blog/kept-post">Kept</a>');
  });

  it('does not rewrite href-shaped text inside other attribute values or text content', () => {
    const html =
      '<a title="see href=/phones/x" href=/blog/dead-draft>Post</a>' +
      '<code>href=/phones/inline-example</code>';

    const result = rewriteHtmlStorefrontHrefs(html, {
      baseUrl: 'https://ogabassey.com',
      merchantSlug: 'ogabassey',
    });

    expect(result).toContain('title="see href=/phones/x"');
    expect(result).toContain('href="/blog/dead-draft"');
    expect(result).toContain('<code>href=/phones/inline-example</code>');
  });

  it('preserves single-quote style when rewriting quoted hrefs', () => {
    const result = rewriteHtmlStorefrontHrefs(
      "<a href='/phones/iphone-15'>Phone</a>",
      { baseUrl: 'https://ogabassey.com', merchantSlug: 'ogabassey' }
    );

    expect(result).toBe("<a href='/smartphones/iphone-15'>Phone</a>");
  });
});
