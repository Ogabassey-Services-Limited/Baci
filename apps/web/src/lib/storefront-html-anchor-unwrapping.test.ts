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
