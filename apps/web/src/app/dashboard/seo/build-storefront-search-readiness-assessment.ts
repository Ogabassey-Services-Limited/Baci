export type StorefrontSearchReadinessFindingCode =
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
  findings: StorefrontSearchReadinessFinding[];
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
  const findings: StorefrontSearchReadinessFinding[] = [];
  if (!hasStoreCopy)
    findings.push({ code: 'store_copy', href: '/dashboard/settings' });
  if (!hasSupportDetails) {
    findings.push({ code: 'support_details', href: '/dashboard/settings' });
  }
  if (!hasPolicies) {
    findings.push({
      code: 'trust_policies',
      href: '/dashboard/settings/trust',
    });
  }
  if (activeProductCount > 0 && missingProductDescriptionCount > 0) {
    findings.push({
      code: 'product_descriptions',
      href: '/dashboard/products',
    });
  }
  if (activeProductCount > 0 && missingProductImageCount > 0) {
    findings.push({ code: 'product_images', href: '/dashboard/products' });
  }
  if (missingCategoryIntroductionCount > 0) {
    findings.push({
      code: 'category_introductions',
      href: '/dashboard/categories',
    });
  }

  return {
    tier: homeIndexable
      ? findings.length === 0
        ? 'enhanced'
        : 'indexable'
      : 'blocked',
    findings,
  };
}
