import { describe, expect, it } from 'vitest';
import { buildStorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';

describe('buildStorefrontSearchReadinessAssessment', () => {
  it('keeps enrichment gaps as ordered improvements for an indexable storefront', () => {
    expect(
      buildStorefrontSearchReadinessAssessment({
        homeIndexable: true,
        hasStoreCopy: false,
        hasSupportDetails: false,
        hasPolicies: false,
        activeProductCount: 1,
        missingProductDescriptionCount: 1,
        missingProductImageCount: 1,
        missingCategoryIntroductionCount: 1,
      })
    ).toEqual({
      tier: 'indexable',
      findings: [
        { code: 'store_copy', href: '/dashboard/settings' },
        { code: 'support_details', href: '/dashboard/settings' },
        { code: 'trust_policies', href: '/dashboard/settings/trust' },
        { code: 'product_descriptions', href: '/dashboard/products' },
        { code: 'product_images', href: '/dashboard/products' },
        { code: 'category_introductions', href: '/dashboard/categories' },
      ],
    });
  });

  it('uses blocked only for the home hard decision', () => {
    expect(
      buildStorefrontSearchReadinessAssessment({
        homeIndexable: false,
        hasStoreCopy: true,
        hasSupportDetails: true,
        hasPolicies: true,
        activeProductCount: 0,
        missingProductDescriptionCount: 0,
        missingProductImageCount: 0,
        missingCategoryIntroductionCount: 0,
      }).tier
    ).toBe('blocked');
  });
});
