import { describe, expect, it } from 'vitest';
import { resolveLegacyBlogPath } from './resolve-legacy-blog-path';

describe('resolveLegacyBlogPath', () => {
  it('classifies archive-style category URLs as invalid routes', () => {
    expect(resolveLegacyBlogPath(['category', '1976', '1'])).toEqual({
      type: 'invalid',
    });
  });

  it('classifies tag archive URLs as invalid routes', () => {
    expect(resolveLegacyBlogPath(['tag', 'iphone'])).toEqual({
      type: 'invalid',
    });
  });

  it('maps dated legacy permalinks to the final post slug', () => {
    expect(
      resolveLegacyBlogPath([
        '2024',
        '10',
        '14',
        'macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere',
      ])
    ).toEqual({
      type: 'post-alias',
      candidatePostSlug:
        'macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere',
    });
  });

  it('rejects feed URLs instead of treating them as canonical posts', () => {
    expect(
      resolveLegacyBlogPath([
        'apple-watch-series-8-the-smartwatch-thats-got-your-back-literally',
        'feed',
      ])
    ).toEqual({
      type: 'invalid',
    });
  });

  it('treats generic legacy category-prefix URLs as post candidates', () => {
    expect(
      resolveLegacyBlogPath(['mobile-gadgets', 'buying-a-used-iphone-in-2025'])
    ).toEqual({
      type: 'post-alias',
      candidatePostSlug: 'buying-a-used-iphone-in-2025',
    });
  });

  it('rejects known spam paths instead of trying to canonicalize them', () => {
    expect(resolveLegacyBlogPath(['shopdetail', '145043534'])).toEqual({
      type: 'invalid',
    });
  });

  it('keeps the blog sitemap redirect explicit', () => {
    expect(resolveLegacyBlogPath(['sitemap.xml'])).toEqual({
      type: 'sitemap',
    });
  });

  it('rejects incomplete dated archive paths without a post slug', () => {
    expect(resolveLegacyBlogPath(['2024', '10', '24'])).toEqual({
      type: 'invalid',
    });
  });
});
