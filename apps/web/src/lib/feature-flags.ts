/**
 * Feature Flags System for Baci
 *
 * Controls access to premium features based on merchant subscription plan.
 * Used to gate Smart Cart Pro and other premium features.
 */

// Feature keys - add new features here
export const FEATURES = {
  // Smart Cart Pro features
  PRICE_NEGOTIATION: 'price_negotiation',
  DEVICE_ASSURANCE: 'device_assurance',
  SMART_UPSELLS: 'smart_upsells',
  CART_ABANDONMENT: 'cart_abandonment',
  CART_ANALYTICS: 'cart_analytics',

  // Other premium features
  CUSTOM_DOMAIN: 'custom_domain',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  PRIORITY_SUPPORT: 'priority_support',
  AI_PRODUCT_DESCRIPTIONS: 'ai_product_descriptions',
  BULK_PRODUCT_IMPORT: 'bulk_product_import',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

// Plan tiers
export const PLAN_TIERS = [
  'free',
  'starter',
  'pro',
  'business',
  'enterprise',
] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

export function isPlanTier(
  value: string | null | undefined
): value is PlanTier {
  return typeof value === 'string' && PLAN_TIERS.some((tier) => tier === value);
}

// Default features by plan
const PLAN_FEATURES: Record<PlanTier, FeatureKey[]> = {
  free: [],
  starter: [FEATURES.CUSTOM_DOMAIN],
  pro: [
    FEATURES.CUSTOM_DOMAIN,
    FEATURES.PRICE_NEGOTIATION,
    FEATURES.DEVICE_ASSURANCE,
    FEATURES.SMART_UPSELLS,
    FEATURES.AI_PRODUCT_DESCRIPTIONS,
  ],
  business: [
    FEATURES.CUSTOM_DOMAIN,
    FEATURES.PRICE_NEGOTIATION,
    FEATURES.DEVICE_ASSURANCE,
    FEATURES.SMART_UPSELLS,
    FEATURES.CART_ABANDONMENT,
    FEATURES.CART_ANALYTICS,
    FEATURES.AI_PRODUCT_DESCRIPTIONS,
    FEATURES.BULK_PRODUCT_IMPORT,
    FEATURES.ADVANCED_ANALYTICS,
  ],
  enterprise: [
    // All features
    ...Object.values(FEATURES),
  ],
};

// Smart Cart Pro bundle
export const SMART_CART_PRO_FEATURES: FeatureKey[] = [
  FEATURES.PRICE_NEGOTIATION,
  FEATURES.DEVICE_ASSURANCE,
  FEATURES.SMART_UPSELLS,
  FEATURES.CART_ABANDONMENT,
  FEATURES.CART_ANALYTICS,
];

/**
 * Check if a plan tier has access to a specific feature
 */
export function planHasFeature(
  planTier: PlanTier,
  feature: FeatureKey
): boolean {
  return PLAN_FEATURES[planTier]?.includes(feature) ?? false;
}

/**
 * Get all features available for a plan
 */
export function getPlanFeatures(planTier: PlanTier): FeatureKey[] {
  return PLAN_FEATURES[planTier] ?? [];
}

/**
 * Check if a plan has Smart Cart Pro
 */
export function hasSmartCartPro(planTier: PlanTier): boolean {
  // Has Smart Cart Pro if they have at least 3 of the 5 features
  const proFeatures = SMART_CART_PRO_FEATURES.filter((f) =>
    planHasFeature(planTier, f)
  );
  return proFeatures.length >= 3;
}

/**
 * Feature metadata for UI display
 */
export const FEATURE_METADATA: Record<
  FeatureKey,
  {
    name: string;
    description: string;
    icon: string;
    minPlan: PlanTier;
  }
> = {
  [FEATURES.PRICE_NEGOTIATION]: {
    name: 'Price Negotiation',
    description: 'Let customers make offers on products',
    icon: 'handshake',
    minPlan: 'pro',
  },
  [FEATURES.DEVICE_ASSURANCE]: {
    name: 'Device Assurance',
    description: 'Add warranty protection at checkout',
    icon: 'shield-check',
    minPlan: 'pro',
  },
  [FEATURES.SMART_UPSELLS]: {
    name: 'Smart Upsells',
    description: 'AI-powered product recommendations',
    icon: 'trending-up',
    minPlan: 'pro',
  },
  [FEATURES.CART_ABANDONMENT]: {
    name: 'Cart Recovery',
    description: 'Automated abandoned cart emails',
    icon: 'mail',
    minPlan: 'business',
  },
  [FEATURES.CART_ANALYTICS]: {
    name: 'Cart Analytics',
    description: 'Detailed cart behavior insights',
    icon: 'bar-chart',
    minPlan: 'business',
  },
  [FEATURES.CUSTOM_DOMAIN]: {
    name: 'Custom Domain',
    description: 'Use your own domain name',
    icon: 'globe',
    minPlan: 'starter',
  },
  [FEATURES.ADVANCED_ANALYTICS]: {
    name: 'Advanced Analytics',
    description: 'Detailed sales and traffic reports',
    icon: 'activity',
    minPlan: 'business',
  },
  [FEATURES.PRIORITY_SUPPORT]: {
    name: 'Priority Support',
    description: '24/7 dedicated support team',
    icon: 'headphones',
    minPlan: 'enterprise',
  },
  [FEATURES.AI_PRODUCT_DESCRIPTIONS]: {
    name: 'AI Descriptions',
    description: 'Generate product descriptions with AI',
    icon: 'sparkles',
    minPlan: 'pro',
  },
  [FEATURES.BULK_PRODUCT_IMPORT]: {
    name: 'Bulk Import',
    description: 'Import products from CSV/Excel',
    icon: 'upload',
    minPlan: 'business',
  },
};

/**
 * Get upgrade CTA for a feature
 */
export function getUpgradeCTA(feature: FeatureKey): {
  title: string;
  description: string;
  targetPlan: PlanTier;
} {
  const metadata = FEATURE_METADATA[feature];
  return {
    title: `Unlock ${metadata.name}`,
    description: metadata.description,
    targetPlan: metadata.minPlan,
  };
}
