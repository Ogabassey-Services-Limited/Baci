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
    ).toContain(
      '<a href="/smartphones/iphone-13-pro-6gb-256gb">iPhone</a> <a href="/products">Old product</a>'
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
    ).toContain(
      "<a href='/smartphones/iphone-13-pro-6gb-256gb'>iPhone</a> <a href='/products'>Old product</a>"
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
    ).toContain('<a href="/smartphones/iphone-13-pro-6gb-256gb">iPhone</a>');
  });
});
