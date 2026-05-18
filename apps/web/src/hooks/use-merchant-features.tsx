'use client';

/**
 * React hook for checking merchant feature access
 *
 * Usage:
 *   const { hasFeature, planTier, canUseSmartCartPro } = useMerchantFeatures();
 *
 *   if (hasFeature('price_negotiation')) {
 *     // Show negotiation UI
 *   }
 */

import { useMerchantSafe } from '@/hooks/use-merchant-client';
import {
  FEATURE_METADATA,
  type FeatureKey,
  getPlanFeatures,
  getUpgradeCTA,
  hasSmartCartPro,
  type PlanTier,
  planHasFeature,
} from '@/lib/feature-flags';

interface MerchantFeaturesResult {
  /** Current plan tier */
  planTier: PlanTier;

  /** Check if merchant has access to a feature */
  hasFeature: (feature: FeatureKey) => boolean;

  /** All features available on current plan */
  availableFeatures: FeatureKey[];

  /** Whether Smart Cart Pro is enabled */
  canUseSmartCartPro: boolean;

  /** Get upgrade CTA for a locked feature */
  getUpgradeInfo: (feature: FeatureKey) => {
    title: string;
    description: string;
    targetPlan: PlanTier;
  };

  /** Whether the merchant is on a paid plan */
  isPaidPlan: boolean;

  /** Loading state */
  isLoading: boolean;
}

export function useMerchantFeatures(): MerchantFeaturesResult {
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const isLoading = merchantContext?.loading ?? true;

  // Get plan tier from merchant data (default to 'free')
  // TODO: Add plan_tier column to merchants table
  const planTier: PlanTier = (() => {
    if (!merchant) return 'free';

    // If merchant has plan_tier field, use it
    // @ts-expect-error - plan_tier not yet in type
    if (merchant.plan_tier) {
      // @ts-expect-error - plan_tier not yet in type
      return merchant.plan_tier as PlanTier;
    }

    // Temporary: Check for known premium merchants
    // Remove this once plan_tier is in database
    const premiumSlugs = ['ogabassey', 'demo-premium'];
    if (merchant.slug && premiumSlugs.includes(merchant.slug)) {
      return 'pro';
    }

    return 'free';
  })();

  const hasFeature = (feature: FeatureKey) => planHasFeature(planTier, feature);

  const availableFeatures = getPlanFeatures(planTier);

  const canUseSmartCartPro = hasSmartCartPro(planTier);

  const isPaidPlan = planTier !== 'free';

  return {
    planTier,
    hasFeature,
    availableFeatures,
    canUseSmartCartPro,
    getUpgradeInfo: getUpgradeCTA,
    isPaidPlan,
    isLoading,
  };
}

/**
 * Component wrapper that renders children only if feature is available
 * Shows upgrade prompt otherwise
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgrade = true,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}) {
  const { hasFeature, getUpgradeInfo } = useMerchantFeatures();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    const { title, description, targetPlan } = getUpgradeInfo(feature);
    const _metadata = FEATURE_METADATA[feature];

    return (
      <div className="bg-linear-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-linear-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-amber-600 text-2xl">⭐</span>
        </div>
        <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        <button
          type="button"
          className="bg-linear-to-r from-purple-600 to-indigo-600 text-white font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Upgrade to {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}
        </button>
      </div>
    );
  }

  return null;
}
