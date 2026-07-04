import { describe, expect, it } from 'vitest';
import { unwrapDeadHtmlAnchors } from '@/lib/storefront-html-anchor-unwrapping';

describe('unwrapDeadHtmlAnchors', () => {
  it('returns html unchanged when it contains no anchors', () => {
    const html = '<p>No links here</p>';

    expect(unwrapDeadHtmlAnchors(html, () => true)).toBe(html);
  });

  it('returns empty string unchanged', () => {
    expect(unwrapDeadHtmlAnchors('', () => true)).toBe('');
  });

  it('unwraps an anchor whose href is reported dead', () => {
    const html = '<p><a href="/blog/draft-post">Draft Post</a></p>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('<p>Draft Post</p>');
  });

  it('leaves an anchor untouched when its href is not dead', () => {
    const html = '<p><a href="/blog/live-post">Live Post</a></p>';

    const result = unwrapDeadHtmlAnchors(html, () => false);

    expect(result).toBe(html);
  });

  it('unwraps only the dead anchor among multiple anchors', () => {
    const html =
      '<p><a href="/blog/draft-post">Draft</a> and <a href="/blog/live-post">Live</a></p>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('<p>Draft and <a href="/blog/live-post">Live</a></p>');
  });

  it('preserves inner markup when unwrapping an anchor', () => {
    const html =
      '<p><a href="/blog/draft-post"><strong>Draft</strong> post</a></p>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('<p><strong>Draft</strong> post</p>');
  });

  it('leaves an anchor without an href attribute untouched', () => {
    const html = '<p><a name="anchor-only">Jump target</a></p>';

    const result = unwrapDeadHtmlAnchors(html, () => true);

    expect(result).toBe(html);
  });

  it('decodes &amp; entities in the href before calling isDeadHref', () => {
    const html =
      '<p><a href="/blog/draft-post?ref=news&amp;utm=1">Draft Post</a></p>';
    const seenHrefs: string[] = [];

    const result = unwrapDeadHtmlAnchors(html, (href) => {
      seenHrefs.push(href);
      return href === '/blog/draft-post?ref=news&utm=1';
    });

    expect(seenHrefs).toEqual(['/blog/draft-post?ref=news&utm=1']);
    expect(result).toBe('<p>Draft Post</p>');
  });

  it('handles single-quoted href attributes', () => {
    const html = "<p><a href='/blog/draft-post'>Draft Post</a></p>";

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('<p>Draft Post</p>');
  });
});

describe('unwrapDeadHtmlAnchors with rewriteHref', () => {
  it('rewrites redirectable hrefs in place instead of unwrapping', () => {
    const html =
      '<p>Get the <a href="/audio/apple-airpods-2" class="link">AirPods 2</a> now.</p>';

    const result = unwrapDeadHtmlAnchors(
      html,
      () => true,
      (href) =>
        href === '/audio/apple-airpods-2' ? '/earbuds/apple-airpods-2' : null
    );

    expect(result).toBe(
      '<p>Get the <a href="/earbuds/apple-airpods-2" class="link">AirPods 2</a> now.</p>'
    );
  });

  it('still unwraps dead anchors that have no rewrite', () => {
    const html = '<p><a href="/blog/draft-post">Draft</a> text.</p>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post',
      () => null
    );

    expect(result).toBe('<p>Draft text.</p>');
  });

  it('escapes attribute-unsafe characters in the rewritten href', () => {
    const html = '<a href="/audio/apple-airpods-2">x</a>';

    const result = unwrapDeadHtmlAnchors(
      html,
      () => false,
      () => '/earbuds/apple-airpods-2?a=1&b="2"'
    );

    expect(result).toBe(
      '<a href="/earbuds/apple-airpods-2?a=1&amp;b=&quot;2&quot;">x</a>'
    );
  });
});

describe('unwrapDeadHtmlAnchors parsing hardening', () => {
  it('ignores href-shaped text inside the anchor inner content', () => {
    const html =
      '<p><a class="x">see href="/blog/draft-post" for details</a></p>';

    const result = unwrapDeadHtmlAnchors(html, () => true);

    // the anchor has no real href, so it must be left untouched
    expect(result).toBe(html);
  });

  it('parses opening tags containing a literal > inside a quoted attribute', () => {
    const html = '<a title="a > b" href="/blog/draft-post">Dead</a>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('Dead');
  });

  it('decodes numeric entities in hrefs before the dead check', () => {
    // /blog/draft-post with 'd' encoded as decimal and hex entities
    const html = '<a href="/blog/&#100;raft-&#x70;ost">Dead</a>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('Dead');
  });
});

describe('unwrapDeadHtmlAnchors href attribute matching', () => {
  it('ignores data-href when the anchor has no real href', () => {
    const html = '<a data-href="/blog/draft-post" class="x">Kept</a>';

    const result = unwrapDeadHtmlAnchors(html, () => true);

    expect(result).toBe(html);
  });

  it('uses the real href when data-href is also present', () => {
    const html =
      '<a data-href="/blog/live-post" href="/blog/draft-post">Dead</a>';

    const result = unwrapDeadHtmlAnchors(
      html,
      (href) => href === '/blog/draft-post'
    );

    expect(result).toBe('Dead');
  });
});
