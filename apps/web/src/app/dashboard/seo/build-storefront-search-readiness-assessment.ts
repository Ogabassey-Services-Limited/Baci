export type StorefrontSearchReadinessFindingCode =
  | 'home_not_indexable'
  | 'empty_active_catalog'
  | 'store_copy'
  | 'support_details'
  | 'trust_policies'
  | 'product_descriptions'
  | 'product_images'
  | 'category_introductions';

export interface StorefrontSearchReadinessFinding {
  code: StorefrontSearchReadinessFindingCode;
  href:
    | '/dashboard/settings'
    | '/dashboard/settings/trust'
    | '/dashboard/products'
    | '/dashboard/categories';
}

export interface StorefrontSearchReadinessAssessment {
  tier: 'blocked' | 'indexable' | 'enhanced';
  blockers: StorefrontSearchReadinessFinding[];
  improvements: StorefrontSearchReadinessFinding[];
}

export function buildStorefrontSearchReadinessAssessment({
  homeIndexable,
  hasStoreCopy,
  hasSupportDetails,
  hasPolicies,
  activeProductCount,
  missingProductDescriptionCount,
  missingProductImageCount,
  missingCategoryIntroductionCount,
}: {
  homeIndexable: boolean;
  hasStoreCopy: boolean;
  hasSupportDetails: boolean;
  hasPolicies: boolean;
  activeProductCount: number;
  missingProductDescriptionCount: number;
  missingProductImageCount: number;
  missingCategoryIntroductionCount: number;
}): StorefrontSearchReadinessAssessment {
  const blockers: StorefrontSearchReadinessFinding[] = [];
  const improvements: StorefrontSearchReadinessFinding[] = [];
  if (!homeIndexable) {
    blockers.push({ code: 'home_not_indexable', href: '/dashboard/settings' });
  }
  if (activeProductCount === 0) {
    improvements.push({
      code: 'empty_active_catalog',
      href: '/dashboard/products',
    });
  }
  if (!hasStoreCopy)
    improvements.push({ code: 'store_copy', href: '/dashboard/settings' });
  if (!hasSupportDetails) {
    improvements.push({ code: 'support_details', href: '/dashboard/settings' });
  }
  if (!hasPolicies) {
    improvements.push({
      code: 'trust_policies',
      href: '/dashboard/settings/trust',
    });
  }
  if (activeProductCount > 0 && missingProductDescriptionCount > 0) {
    improvements.push({
      code: 'product_descriptions',
      href: '/dashboard/products',
    });
  }
  if (activeProductCount > 0 && missingProductImageCount > 0) {
    improvements.push({ code: 'product_images', href: '/dashboard/products' });
  }
  if (missingCategoryIntroductionCount > 0) {
    improvements.push({
      code: 'category_introductions',
      href: '/dashboard/categories',
    });
  }

  return {
    tier: homeIndexable
      ? improvements.length === 0
        ? 'enhanced'
        : 'indexable'
      : 'blocked',
    blockers,
    improvements,
  };
}
