import { describe, expect, it } from 'vitest';
import { resolveRenderedInternalLink } from './resolve-rendered-internal-link';

const REWRITES = {
  blogSlugs: { 'renamed-post': 'new-post' },
  productPaths: { 'apple-airpods-2': '/earbuds/apple-airpods-2' },
};

describe('resolveRenderedInternalLink', () => {
  it('rewrites redirectable hrefs and never reports them dead', () => {
    const result = resolveRenderedInternalLink('/audio/apple-airpods-2', {
      contentLinkRewrites: REWRITES,
      deadProductSlugs: new Set(['apple-airpods-2']),
    });

    expect(result).toEqual({
      href: '/earbuds/apple-airpods-2',
      isDead: false,
    });
  });

  it('reports confirmed-dead hrefs without a rewrite as dead', () => {
    const result = resolveRenderedInternalLink('/blog/draft-post', {
      deadBlogSlugs: new Set(['draft-post']),
    });

    expect(result).toEqual({ href: '/blog/draft-post', isDead: true });
  });

  it('passes live hrefs through unchanged', () => {
    const result = resolveRenderedInternalLink('/blog/live-post', {
      contentLinkRewrites: REWRITES,
      deadBlogSlugs: new Set(['draft-post']),
    });

    expect(result).toEqual({ href: '/blog/live-post', isDead: false });
  });

  it('never touches non-relative hrefs', () => {
    for (const href of [
      'https://example.com/blog/draft-post',
      '//evil.example/x',
      '#section',
    ]) {
      expect(
        resolveRenderedInternalLink(href, {
          deadBlogSlugs: new Set(['draft-post']),
        })
      ).toEqual({ href, isDead: false });
    }
  });
});
