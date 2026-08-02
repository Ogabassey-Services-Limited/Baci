import { describe, expect, it } from 'vitest';
import { buildStorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';

describe('SEO dashboard readiness', () => {
  it('identifies the home indexing blocker and an empty active catalog', () => {
    const assessment = buildStorefrontSearchReadinessAssessment({
      homeIndexable: false,
      hasStoreCopy: true,
      hasSupportDetails: true,
      hasPolicies: true,
      activeProductCount: 0,
      missingProductDescriptionCount: 0,
      missingProductImageCount: 0,
      missingCategoryIntroductionCount: 0,
    });

    expect(assessment.blockers).toContainEqual(
      expect.objectContaining({ code: 'home_not_indexable' })
    );
    expect(assessment.improvements).toContainEqual(
      expect.objectContaining({ code: 'empty_active_catalog' })
    );
  });
});
