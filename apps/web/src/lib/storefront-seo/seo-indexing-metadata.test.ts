import { describe, expect, it } from 'vitest';
import { buildHomeSeoDecision } from './build-home-seo-decision';
import {
  isSeoSitemapEligible,
  toNextRobotsMetadata,
} from './seo-indexing-metadata';

describe('SEO indexing metadata adapters', () => {
  it('uses the decision as the only sitemap and robots authority', () => {
    const decision = buildHomeSeoDecision({
      isPublished: false,
      canonicalUrl: 'https://zorvexa.usebaci.com',
      merchantName: 'Zorvexa',
    });

    expect(toNextRobotsMetadata(decision)).toEqual({
      index: false,
      follow: true,
    });
    expect(isSeoSitemapEligible(decision)).toBe(false);
  });
});
