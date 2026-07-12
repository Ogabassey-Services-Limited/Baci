'use client';

import { useEffect, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';

/**
 * Storefront Feature Settings (Public)
 */
export interface StorefrontFeatures {
  loyaltyEnabled: boolean;
  reviewsEnabled: boolean;
  wishlistEnabled: boolean;
  orderTrackingEnabled: boolean;
  discountCodesEnabled: boolean;
  guestCheckoutEnabled: boolean;
  shippingProviders: string[];
  freeShippingThreshold: number | null;
  collectPhone: boolean;
  requireAccount: boolean;
  showOrderNotes: boolean;
  pages: {
    about: boolean;
    contact: boolean;
    faq: boolean;
    privacy: boolean;
    terms: boolean;
    rewards: boolean;
  };
  showRecentPurchases: boolean;
  showStockLevels: boolean;
  lowStockThreshold: number;
  hasGoogleAnalytics: boolean;
  hasFacebookPixel: boolean;
  hasTiktokPixel: boolean;
  repairsCatalogEnabled: boolean;
}

/**
 * Full Merchant Feature Settings (Dashboard)
 */
export interface MerchantFeatureSettings {
  id: string;
  merchant_id: string;

  // Feature toggles
  loyalty_enabled: boolean;
  reviews_enabled: boolean;
  wishlist_enabled: boolean;
  order_tracking_enabled: boolean;
  discount_codes_enabled: boolean;
  guest_checkout_enabled: boolean;

  // Shipping
  shipping_providers: string[];
  free_shipping_threshold: number | null;
  shipping_markup_percentage: number;

  // Checkout
  checkout_collect_phone: boolean;
  checkout_require_account: boolean;
  checkout_show_order_notes: boolean;

  // Store pages
  about_page_enabled: boolean;
  contact_page_enabled: boolean;
  faq_page_enabled: boolean;
  privacy_page_enabled: boolean;
  terms_page_enabled: boolean;
  rewards_page_enabled: boolean;

  // Social proof
  show_recent_purchases: boolean;
  show_stock_levels: boolean;
  low_stock_threshold: number;

  // Analytics
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  tiktok_pixel_id: string | null;

  // SEO
  auto_generate_schema: boolean;
  custom_robots_txt: string | null;

  // Blog
  blog_enabled: boolean;
  auto_blog_enabled: boolean;
  google_reviews_enabled: boolean;
  google_place_id: string | null;

  // Notifications
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;

  // Shipping Insurance (MyCover.ai)
  shipping_insurance_enabled: boolean;
  shipping_insurance_min_order_value: number | null;
  shipping_insurance_opt_in_default: boolean;

  // Custom
  custom_settings: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

// Default features for storefront
const DEFAULT_STOREFRONT_FEATURES: StorefrontFeatures = {
  loyaltyEnabled: false,
  reviewsEnabled: true,
  wishlistEnabled: true,
  orderTrackingEnabled: true,
  discountCodesEnabled: true,
  guestCheckoutEnabled: true,
  shippingProviders: ['gigl', 'topship'],
  freeShippingThreshold: null,
  collectPhone: true,
  requireAccount: false,
  showOrderNotes: true,
  pages: {
    about: true,
    contact: true,
    faq: true,
    privacy: true,
    terms: true,
    rewards: false,
  },
  showRecentPurchases: false,
  showStockLevels: true,
  lowStockThreshold: 10,
  hasGoogleAnalytics: false,
  hasFacebookPixel: false,
  hasTiktokPixel: false,
  repairsCatalogEnabled: false,
};

interface UseStorefrontFeaturesOptions {
  merchantId?: string;
  slug?: string;
  autoFetch?: boolean;
}

type StorefrontFeaturesResult =
  | { ok: true; features: StorefrontFeatures }
  | { ok: false; error: string };

/**
 * Module-scope fetch helper. Keeping the try/catch/finally control flow out of
 * the hook body (and out of the effect's synchronous path) lets React Compiler
 * memoize the hook: it cannot lower try/finally, and synchronous setState in an
 * effect triggers cascading renders.
 */
async function fetchStorefrontFeatures(
  merchantId?: string,
  slug?: string
): Promise<StorefrontFeaturesResult> {
  try {
    const params = new URLSearchParams();
    if (merchantId) params.set('merchantId', merchantId);
    if (slug) params.set('slug', slug);

    const response = await fetch(`/api/storefront/features?${params}`);
    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to fetch features' };
    }

    return { ok: true, features: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to fetch features',
    };
  }
}

/**
 * Hook for storefront to get public feature settings
 */
export function useStorefrontFeatures({
  merchantId,
  slug,
  autoFetch = true,
}: UseStorefrontFeaturesOptions) {
  const [features, setFeatures] = useState<StorefrontFeatures>(
    DEFAULT_STOREFRONT_FEATURES
  );
  // Initialise loading to reflect whether an auto-fetch will run, so the effect
  // never needs a synchronous setIsLoading(true).
  const [isLoading, setIsLoading] = useState(
    () => autoFetch && Boolean(merchantId || slug)
  );
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    if (!merchantId && !slug) return;

    setIsLoading(true);
    setError(null);

    const result = await fetchStorefrontFeatures(merchantId, slug);
    if (result.ok) {
      setFeatures(result.features);
    } else {
      setFeatures(DEFAULT_STOREFRONT_FEATURES);
      setError(result.error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!(autoFetch && (merchantId || slug))) {
      return;
    }

    let cancelled = false;

    fetchStorefrontFeatures(merchantId, slug).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFeatures(result.features);
        setError(null);
      } else {
        setFeatures(DEFAULT_STOREFRONT_FEATURES);
        setError(result.error);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [autoFetch, merchantId, slug]);

  return {
    features,
    isLoading,
    error,
    refresh: fetchFeatures,

    // Convenience accessors
    isLoyaltyEnabled: features.loyaltyEnabled,
    isReviewsEnabled: features.reviewsEnabled,
    isWishlistEnabled: features.wishlistEnabled,
    isOrderTrackingEnabled: features.orderTrackingEnabled,
    isDiscountCodesEnabled: features.discountCodesEnabled,
    isGuestCheckoutEnabled: features.guestCheckoutEnabled,
    isRepairsCatalogEnabled: features.repairsCatalogEnabled,
    pages: features.pages,
    shippingProviders: features.shippingProviders,
    freeShippingThreshold: features.freeShippingThreshold,
  };
}

type MerchantSettingsResult =
  | { ok: true; settings: MerchantFeatureSettings }
  | { ok: false; error: string };

/**
 * Module-scope fetch helper (see fetchStorefrontFeatures for rationale).
 */
async function fetchMerchantSettings(): Promise<MerchantSettingsResult> {
  try {
    const response = await fetch('/api/merchant/features');
    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to fetch settings' };
    }

    return { ok: true, settings: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to fetch settings',
    };
  }
}

/**
 * Module-scope update helper. Owns the try/catch/finally control flow so the
 * hook body stays compiler-friendly.
 */
async function patchMerchantSettings(
  updates: Partial<MerchantFeatureSettings>
): Promise<MerchantSettingsResult> {
  try {
    const response = await fetchWithCsrf('/api/merchant/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to update settings' };
    }

    return { ok: true, settings: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update settings',
    };
  }
}

/**
 * Hook for merchant dashboard to manage feature settings
 */
export function useMerchantFeatures() {
  const [settings, setSettings] = useState<MerchantFeatureSettings | null>(
    null
  );
  // Auto-fetch always runs on mount, so start in the loading state and avoid a
  // synchronous setIsLoading(true) inside the effect.
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchMerchantSettings();
    if (result.ok) {
      setSettings(result.settings);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const updateSettings = async (
    updates: Partial<MerchantFeatureSettings>
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    const result = await patchMerchantSettings(updates);
    if (result.ok) {
      setSettings(result.settings);
    } else {
      setError(result.error);
    }
    setIsSaving(false);
    return result.ok;
  };

  const toggleFeature = async (
    feature: keyof MerchantFeatureSettings
  ): Promise<boolean> => {
    await Promise.resolve(); // Satisfy linter
    if (!settings) return false;

    const currentValue = settings[feature];
    if (typeof currentValue !== 'boolean') return false;

    return updateSettings({ [feature]: !currentValue });
  };

  useEffect(() => {
    let cancelled = false;

    fetchMerchantSettings().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSettings(result.settings);
        setError(null);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    refresh: fetchSettings,
    updateSettings,
    toggleFeature,

    // Convenience accessors (with defaults)
    loyaltyEnabled: settings?.loyalty_enabled ?? false,
    reviewsEnabled: settings?.reviews_enabled ?? true,
    wishlistEnabled: settings?.wishlist_enabled ?? true,
    orderTrackingEnabled: settings?.order_tracking_enabled ?? true,
    discountCodesEnabled: settings?.discount_codes_enabled ?? true,
    guestCheckoutEnabled: settings?.guest_checkout_enabled ?? true,
    shippingProviders: settings?.shipping_providers ?? ['gigl', 'topship'],
    freeShippingThreshold: settings?.free_shipping_threshold ?? null,
    blogEnabled: settings?.blog_enabled ?? false,
    autoBlogEnabled: settings?.auto_blog_enabled ?? false,
    googleReviewsEnabled: settings?.google_reviews_enabled ?? false,
    googlePlaceId: settings?.google_place_id ?? null,
    shippingInsuranceEnabled: settings?.shipping_insurance_enabled ?? false,
    shippingInsuranceMinOrderValue:
      settings?.shipping_insurance_min_order_value ?? 5000,
    shippingInsuranceOptInDefault:
      settings?.shipping_insurance_opt_in_default ?? false,
  };
}
