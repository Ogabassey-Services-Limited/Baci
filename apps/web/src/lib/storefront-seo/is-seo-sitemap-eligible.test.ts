import { describe, expect, it } from 'vitest';
import { isSeoSitemapEligible } from './is-seo-sitemap-eligible';

describe('isSeoSitemapEligible', () => {
  it('uses the indexing decision as the sitemap authority', () => {
    expect(
      isSeoSitemapEligible({
        pageKind: 'home',
        index: false,
        follow: true,
        blockers: ['store_unpublished'],
      })
    ).toBe(false);
  });
});
