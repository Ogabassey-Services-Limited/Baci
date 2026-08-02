import { describe, expect, it } from 'vitest';
import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
} from './seo-indexing-decision';

describe('SEO indexing decision core', () => {
  it('rejects non-web canonical URLs', () => {
    expect(isValidStorefrontCanonicalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidStorefrontCanonicalUrl('/relative-only')).toBe(false);
  });

  it('deduplicates blockers without changing their order', () => {
    expect(
      buildSeoIndexingDecision({
        pageKind: 'product',
        blockers: ['store_unpublished', 'store_unpublished'],
      })
    ).toEqual({
      pageKind: 'product',
      index: false,
      follow: true,
      blockers: ['store_unpublished'],
    });
  });
});
