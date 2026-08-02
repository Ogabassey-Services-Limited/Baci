import { describe, expect, it } from 'vitest';
import { buildHomeSeoDecision } from './build-home-seo-decision';
import { isSeoSitemapEligible } from './seo-indexing-metadata';

describe('buildHomeSeoDecision', () => {
  it('keeps a published homepage indexable without catalog or commerce enrichment', () => {
    const decision = buildHomeSeoDecision({
      isPublished: true,
      canonicalUrl: 'https://zorvexa.usebaci.com',
      merchantName: 'Zorvexa',
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
        isPublished: false,
        canonicalUrl: 'https://zorvexa.usebaci.com',
        merchantName: 'Zorvexa',
      })
    ).toEqual({
      pageKind: 'home',
      index: false,
      follow: true,
      blockers: ['store_unpublished'],
    });
  });

  it('fails closed for missing publication, canonical URL, or merchant name', () => {
    expect(
      buildHomeSeoDecision({
        isPublished: undefined,
        canonicalUrl: null,
        merchantName: '   ',
      })
    ).toEqual({
      pageKind: 'home',
      index: false,
      follow: true,
      blockers: [
        'store_unpublished',
        'missing_canonical_url',
        'missing_merchant_name',
      ],
    });
  });
});
