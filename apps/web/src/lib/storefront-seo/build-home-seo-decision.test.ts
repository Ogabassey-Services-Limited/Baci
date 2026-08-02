import { describe, expect, it } from 'vitest';
import { buildHomeSeoDecision } from './build-home-seo-decision';
import { isSeoSitemapEligible } from './seo-indexing-metadata';

describe('buildHomeSeoDecision', () => {
  it('keeps a published homepage indexable without catalog or commerce enrichment', () => {
    const decision = buildHomeSeoDecision({
      isStorePublished: true,
      canonicalUrl: 'https://zorvexa.usebaci.com',
    });

    expect(decision).toEqual({
      pageKind: 'home',
      index: true,
      follow: true,
      blockers: [],
    });
    expect(isSeoSitemapEligible(decision)).toBe(true);
  });

  it('blocks an unpublished homepage while preserving crawl following', () => {
    expect(
      buildHomeSeoDecision({
        isStorePublished: false,
        canonicalUrl: 'https://zorvexa.usebaci.com',
      })
    ).toEqual({
      pageKind: 'home',
      index: false,
      follow: true,
      blockers: ['store_unpublished'],
    });
  });
});
