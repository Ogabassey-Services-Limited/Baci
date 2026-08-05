import type { SeoIndexingDecision } from '@/lib/storefront-seo/seo-indexing-decision';

export type SearchReadinessHref =
  | '/dashboard/settings'
  | '/dashboard/settings#storefront-profile'
  | '/dashboard/products'
  | '/dashboard/categories'
  | '/dashboard/settings/trust';

export type SearchReadinessFindingCode =
  | 'home_not_indexable'
  | 'missing_custom_store_description'
  | 'missing_public_support_contact'
  | 'missing_published_trust_policy'
  | 'empty_active_catalog'
  | 'products_missing_description'
  | 'products_missing_image'
  | 'categories_missing_custom_intro';

export interface SearchReadinessFinding {
  code: SearchReadinessFindingCode;
  count?: number;
  href: SearchReadinessHref;
}

export interface StorefrontSearchReadinessAssessment {
  tier: 'blocked' | 'indexable' | 'enhanced';
  blockers: readonly SearchReadinessFinding[];
  improvements: readonly SearchReadinessFinding[];
}

export interface StorefrontSearchReadinessInput {
  homeDecision: SeoIndexingDecision;
  hasCustomStoreDescription: boolean;
  hasPublicSupportContact: boolean;
  hasPublishedTrustPolicy: boolean;
  activeProductCount: number;
  productsMissingDescriptionCount: number;
  productsMissingImageCount: number;
  categoriesMissingCustomIntroCount: number;
}

export function buildStorefrontSearchReadinessAssessment({
  homeDecision,
  hasCustomStoreDescription,
  hasPublicSupportContact,
  hasPublishedTrustPolicy,
  activeProductCount,
  productsMissingDescriptionCount,
  productsMissingImageCount,
  categoriesMissingCustomIntroCount,
}: StorefrontSearchReadinessInput): StorefrontSearchReadinessAssessment {
  const blockers: SearchReadinessFinding[] = [];
  const improvements: SearchReadinessFinding[] = [];
  if (!homeDecision.index) {
    blockers.push({ code: 'home_not_indexable', href: '/dashboard/settings' });
  }
  if (activeProductCount === 0) {
    improvements.push({
      code: 'empty_active_catalog',
      href: '/dashboard/products',
    });
  }
  if (!hasCustomStoreDescription)
    improvements.push({
      code: 'missing_custom_store_description',
      href: '/dashboard/settings#storefront-profile',
    });
  if (!hasPublicSupportContact) {
    improvements.push({
      code: 'missing_public_support_contact',
      href: '/dashboard/settings#storefront-profile',
    });
  }
  if (!hasPublishedTrustPolicy) {
    improvements.push({
      code: 'missing_published_trust_policy',
      href: '/dashboard/settings/trust',
    });
  }
  if (activeProductCount > 0 && productsMissingDescriptionCount > 0) {
    improvements.push({
      code: 'products_missing_description',
      count: productsMissingDescriptionCount,
      href: '/dashboard/products',
    });
  }
  if (activeProductCount > 0 && productsMissingImageCount > 0) {
    improvements.push({
      code: 'products_missing_image',
      count: productsMissingImageCount,
      href: '/dashboard/products',
    });
  }
  if (categoriesMissingCustomIntroCount > 0) {
    improvements.push({
      code: 'categories_missing_custom_intro',
      count: categoriesMissingCustomIntroCount,
      href: '/dashboard/categories',
    });
  }

  return {
    tier: homeDecision.index
      ? improvements.length === 0
        ? 'enhanced'
        : 'indexable'
      : 'blocked',
    blockers,
    improvements,
  };
}
