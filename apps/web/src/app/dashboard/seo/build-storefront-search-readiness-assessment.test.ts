import { describe, expect, it } from 'vitest';
import { buildStorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';

describe('buildStorefrontSearchReadinessAssessment', () => {
  it('keeps enrichment gaps as ordered improvements for an indexable storefront', () => {
    expect(
      buildStorefrontSearchReadinessAssessment({
        homeDecision: {
          pageKind: 'home',
          index: true,
          follow: true,
          blockers: [],
        },
        hasCustomStoreDescription: false,
        hasPublicSupportContact: false,
        hasPublishedTrustPolicy: false,
        activeProductCount: 1,
        productsMissingDescriptionCount: 1,
        productsMissingImageCount: 1,
        categoriesMissingCustomIntroCount: 1,
      })
    ).toEqual({
      tier: 'indexable',
      blockers: [],
      improvements: [
        {
          code: 'missing_custom_store_description',
          href: '/dashboard/settings#storefront-profile',
        },
        {
          code: 'missing_public_support_contact',
          href: '/dashboard/settings#storefront-profile',
        },
        {
          code: 'missing_published_trust_policy',
          href: '/dashboard/settings/trust',
        },
        {
          code: 'products_missing_description',
          count: 1,
          href: '/dashboard/products',
        },
        {
          code: 'products_missing_image',
          count: 1,
          href: '/dashboard/products',
        },
        {
          code: 'categories_missing_custom_intro',
          count: 1,
          href: '/dashboard/categories',
        },
      ],
    });
  });

  it('uses blocked only for the home hard decision', () => {
    expect(
      buildStorefrontSearchReadinessAssessment({
        homeDecision: {
          pageKind: 'home',
          index: false,
          follow: true,
          blockers: ['store_unpublished'],
        },
        hasCustomStoreDescription: true,
        hasPublicSupportContact: true,
        hasPublishedTrustPolicy: true,
        activeProductCount: 0,
        productsMissingDescriptionCount: 0,
        productsMissingImageCount: 0,
        categoriesMissingCustomIntroCount: 0,
      })
    ).toMatchObject({
      tier: 'blocked',
      blockers: [{ code: 'home_not_indexable', href: '/dashboard/settings' }],
      improvements: [
        { code: 'empty_active_catalog', href: '/dashboard/products' },
      ],
    });
  });

  it('keeps an empty active catalog out of the enhanced tier', () => {
    expect(
      buildStorefrontSearchReadinessAssessment({
        homeDecision: {
          pageKind: 'home',
          index: true,
          follow: true,
          blockers: [],
        },
        hasCustomStoreDescription: true,
        hasPublicSupportContact: true,
        hasPublishedTrustPolicy: true,
        activeProductCount: 0,
        productsMissingDescriptionCount: 0,
        productsMissingImageCount: 0,
        categoriesMissingCustomIntroCount: 0,
      })
    ).toMatchObject({
      tier: 'indexable',
      blockers: [],
      improvements: [
        { code: 'empty_active_catalog', href: '/dashboard/products' },
      ],
    });
  });
});
