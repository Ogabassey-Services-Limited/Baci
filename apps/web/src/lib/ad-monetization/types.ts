/**
 * Ad Monetization Types & Schema
 *
 * This module defines the types for merchant ad monetization settings.
 * Merchants can enable ads on their storefronts as a paid add-on feature.
 */

// ============================================
// Ad Placement Configuration
// ============================================

export type AdPlacementType =
  | 'banner'
  | 'sidebar'
  | 'in-feed'
  | 'sticky'
  | 'interstitial'
  | 'rewarded';

export interface AdPlacement {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
  type: AdPlacementType;
  // Multiple sizes for responsive ads
  sizes?: [number, number][];
  mobileSizes?: [number, number][];
}

// Standard IAB ad placements
export const AD_PLACEMENTS: Record<string, AdPlacement> = {
  HEADER_LEADERBOARD: {
    id: 'header-leaderboard',
    name: 'Header Leaderboard',
    description: 'High visibility top-of-page banner',
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 100,
    type: 'banner',
  },
  HOMEPAGE_STRIP: {
    id: 'homepage-strip',
    name: 'Homepage Large Strip',
    description: 'Wide banner separating hero content from products',
    width: 970,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
    type: 'banner',
  },
  SIDEBAR_HALF_PAGE: {
    id: 'sidebar-half-page',
    name: 'Sidebar Half Page',
    description: 'Large vertical ad for product detail sidebars',
    width: 300,
    height: 600,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'sidebar',
  },
  PRODUCT_GRID_MPU: {
    id: 'product-grid-mpu',
    name: 'In-Feed MPU',
    description: 'Square ad inserted naturally into product grids',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'in-feed',
  },
  CONTENT_BREAK: {
    id: 'content-break',
    name: 'Content Section Break',
    description: 'Horizontal divider before deep content areas',
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
    type: 'banner',
  },
  CART_MPU: {
    id: 'cart-mpu',
    name: 'Cart Drawer MPU',
    description: 'Square ad visible during checkout flow',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'sidebar',
  },
  FOOTER_BANNER: {
    id: 'footer-banner',
    name: 'Footer Banner',
    description: 'Large footer placement for ending the user journey',
    width: 970,
    height: 250,
    mobileWidth: 320,
    mobileHeight: 100,
    type: 'banner',
  },
  CATEGORY_SIDEBAR: {
    id: 'category-sidebar',
    name: 'Category Sidebar',
    description: 'Sidebar ad on category listing pages',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'sidebar',
    sizes: [
      [300, 250],
      [300, 600],
      [160, 600],
    ],
  },
  BLOG_INLINE: {
    id: 'blog-inline',
    name: 'Blog Inline',
    description: 'Native inline ad within blog content',
    width: 336,
    height: 280,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'in-feed',
  },
  ORDER_CONFIRMATION: {
    id: 'order-confirmation',
    name: 'Order Confirmation',
    description: 'Banner shown after successful checkout',
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 100,
    type: 'banner',
  },
  SEARCH_RESULTS: {
    id: 'search-results',
    name: 'Search Results',
    description: 'In-feed ad within search results',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'in-feed',
  },
  MOBILE_ANCHOR: {
    id: 'mobile-anchor',
    name: 'Mobile Anchor',
    description: 'Sticky banner at bottom of mobile screen',
    width: 320,
    height: 50,
    mobileWidth: 320,
    mobileHeight: 50,
    type: 'sticky',
  },
  POST_ORDER_INTERSTITIAL: {
    id: 'post-order-interstitial',
    name: 'Post-Order Interstitial',
    description: 'Full-screen ad shown after order completion',
    width: 320,
    height: 480,
    mobileWidth: 320,
    mobileHeight: 480,
    type: 'interstitial',
  },
  REWARDED_VIDEO: {
    id: 'rewarded-video',
    name: 'Rewarded Video',
    description: 'Opt-in video ad for discount rewards',
    width: 400,
    height: 300,
    mobileWidth: 320,
    mobileHeight: 250,
    type: 'rewarded',
  },
};

// ============================================
// Merchant Ad Settings
// ============================================

export type AdNetworkProvider = 'google_ad_manager' | 'adsense' | 'both';

export interface MerchantAdCredentials {
  // Google Ad Manager Network Code
  networkCode?: string;
  // AdSense Publisher ID (ca-pub-XXXXXXXXXXXXXXXX)
  adsenseId?: string;
  // Which network to use primarily
  provider: AdNetworkProvider;
}

export interface AdPlacementSettings {
  // Placement key from AD_PLACEMENTS
  placementKey: string;
  // Is this placement enabled?
  enabled: boolean;
  // Custom ad unit ID (overrides default)
  customAdUnitId?: string;
  // Custom sizes for this merchant
  customSizes?: [number, number][];
  // Frequency capping (for in-feed ads - show every N items)
  frequency?: number;
}

export interface RewardedAdSettings {
  // Is rewarded video enabled?
  enabled: boolean;
  // Reward type
  rewardType:
    | 'discount_percent'
    | 'discount_fixed'
    | 'loyalty_points'
    | 'free_shipping';
  // Reward value (e.g., 5 for 5% or 500 for ₦500)
  rewardValue: number;
  // Reward expiry in days (0 = never expires)
  rewardExpiryDays: number;
  // Minimum order value to show rewarded ad
  minOrderValue?: number;
}

export interface AdMonetizationSettings {
  // Master switch - is ad monetization enabled for this merchant?
  enabled: boolean;

  // Ad network credentials
  credentials: MerchantAdCredentials;

  // Individual placement settings
  placements: AdPlacementSettings[];

  // Rewarded video settings
  rewardedAd: RewardedAdSettings;

  // Revenue sharing (platform takes this percentage)
  revenueSharePercent: number;

  // Test mode (shows test ads, no real revenue)
  testMode: boolean;

  // Ad density settings
  maxAdsPerPage?: number;
  minContentBetweenAds?: number; // pixels

  // Analytics
  trackImpressions: boolean;
  trackClicks: boolean;

  // Compliance
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  showAdLabels: boolean; // "Sponsored" labels

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Default Settings
// ============================================

export const DEFAULT_AD_SETTINGS: AdMonetizationSettings = {
  enabled: false,
  credentials: {
    provider: 'adsense',
  },
  placements: Object.keys(AD_PLACEMENTS).map((key) => ({
    placementKey: key,
    enabled: false,
  })),
  rewardedAd: {
    enabled: false,
    rewardType: 'discount_percent',
    rewardValue: 5,
    rewardExpiryDays: 30,
  },
  revenueSharePercent: 30, // Platform takes 30%
  testMode: true,
  maxAdsPerPage: 5,
  minContentBetweenAds: 300,
  trackImpressions: true,
  trackClicks: true,
  gdprCompliant: true,
  ccpaCompliant: true,
  showAdLabels: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================
// Ad Revenue & Analytics Types
// ============================================

export interface AdImpression {
  id: string;
  merchantId: string;
  placementKey: string;
  adUnitId: string;
  timestamp: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  pageUrl: string;
  viewableTime?: number; // seconds the ad was viewable
}

export interface AdClick {
  id: string;
  merchantId: string;
  placementKey: string;
  adUnitId: string;
  impressionId: string;
  timestamp: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
}

export interface AdRevenue {
  id: string;
  merchantId: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate
  rpm: number; // Revenue per mille (per 1000 impressions)
  grossRevenue: number;
  platformFee: number;
  netRevenue: number; // What merchant earns
  currency: string;
}

export interface AdRevenueReport {
  merchantId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalImpressions: number;
  totalClicks: number;
  averageCtr: number;
  averageRpm: number;
  totalGrossRevenue: number;
  totalPlatformFee: number;
  totalNetRevenue: number;
  topPerformingPlacements: Array<{
    placementKey: string;
    impressions: number;
    revenue: number;
  }>;
  dailyBreakdown: AdRevenue[];
}

// ============================================
// Subscription Tiers for Ad Feature
// ============================================

export type AdFeatureTier = 'starter' | 'growth' | 'pro' | 'enterprise';

export interface AdFeaturePricing {
  tier: AdFeatureTier;
  name: string;
  monthlyPrice: number;
  currency: string;
  features: {
    maxPlacements: number;
    rewardedVideoEnabled: boolean;
    interstitialEnabled: boolean;
    revenueSharePercent: number;
    analyticsLevel: 'basic' | 'advanced' | 'premium';
    supportLevel: 'email' | 'priority' | 'dedicated';
  };
}

const AD_FEATURE_TIERS: AdFeaturePricing[] = [
  {
    tier: 'starter',
    name: 'Ad Starter',
    monthlyPrice: 5000, // ₦5,000
    currency: 'NGN',
    features: {
      maxPlacements: 3,
      rewardedVideoEnabled: false,
      interstitialEnabled: false,
      revenueSharePercent: 40,
      analyticsLevel: 'basic',
      supportLevel: 'email',
    },
  },
  {
    tier: 'growth',
    name: 'Ad Growth',
    monthlyPrice: 15000, // ₦15,000
    currency: 'NGN',
    features: {
      maxPlacements: 7,
      rewardedVideoEnabled: true,
      interstitialEnabled: false,
      revenueSharePercent: 30,
      analyticsLevel: 'advanced',
      supportLevel: 'priority',
    },
  },
  {
    tier: 'pro',
    name: 'Ad Pro',
    monthlyPrice: 35000, // ₦35,000
    currency: 'NGN',
    features: {
      maxPlacements: 12,
      rewardedVideoEnabled: true,
      interstitialEnabled: true,
      revenueSharePercent: 20,
      analyticsLevel: 'premium',
      supportLevel: 'priority',
    },
  },
  {
    tier: 'enterprise',
    name: 'Ad Enterprise',
    monthlyPrice: 0, // Custom pricing
    currency: 'NGN',
    features: {
      maxPlacements: -1, // Unlimited
      rewardedVideoEnabled: true,
      interstitialEnabled: true,
      revenueSharePercent: 10,
      analyticsLevel: 'premium',
      supportLevel: 'dedicated',
    },
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a merchant can enable a specific placement based on their tier
 */
export function canEnablePlacement(
  tier: AdFeatureTier,
  currentEnabledCount: number,
  placementKey: string
): boolean {
  const tierConfig = AD_FEATURE_TIERS.find((t) => t.tier === tier);
  if (!tierConfig) return false;

  // Unlimited placements for enterprise
  if (tierConfig.features.maxPlacements === -1) return true;

  // Check if within limit
  if (currentEnabledCount >= tierConfig.features.maxPlacements) return false;

  // Check special placement types
  const placement = AD_PLACEMENTS[placementKey];
  if (
    placement?.type === 'interstitial' &&
    !tierConfig.features.interstitialEnabled
  ) {
    return false;
  }
  if (
    placement?.type === 'rewarded' &&
    !tierConfig.features.rewardedVideoEnabled
  ) {
    return false;
  }

  return true;
}
