'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { createClient } from '@/lib/supabase/client';
import {
  AD_PLACEMENTS,
  type AdFeatureTier,
  type AdMonetizationSettings,
  type AdPlacementSettings,
  canEnablePlacement,
  DEFAULT_AD_SETTINGS,
  type RewardedAdSettings,
} from './types';

// ============================================
// Context Types
// ============================================

interface AdSettingsContextType {
  // Settings state
  settings: AdMonetizationSettings | null;
  loading: boolean;
  error: string | null;

  // Current tier
  tier: AdFeatureTier;

  // Actions
  updateSettings: (updates: Partial<AdMonetizationSettings>) => Promise<void>;
  updatePlacement: (
    placementKey: string,
    updates: Partial<AdPlacementSettings>
  ) => Promise<void>;
  updateRewardedAd: (updates: Partial<RewardedAdSettings>) => Promise<void>;
  enableAllPlacements: () => Promise<void>;
  disableAllPlacements: () => Promise<void>;
  reloadSettings: () => Promise<void>;

  // Helpers
  isPlacementEnabled: (placementKey: string) => boolean;
  canEnableMorePlacements: () => boolean;
  getEnabledPlacementCount: () => number;
}

const AdSettingsContext = createContext<AdSettingsContextType | undefined>(
  undefined
);

// ============================================
// Provider Component
// ============================================

interface AdSettingsProviderProps {
  children: ReactNode;
}

export function AdSettingsProvider({ children }: AdSettingsProviderProps) {
  const merchant = useMerchantSafe();
  const [settings, setSettings] = useState<AdMonetizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<AdFeatureTier>('starter');

  const supabase = createClient();

  // Load settings from database
  const loadSettings = async () => {
    if (!merchant?.merchant?.id) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // PERFORMANCE: Use Promise.all to fetch independent queries concurrently
      // Load main settings, placements, and rewarded settings at once
      const [
        { data: mainSettings, error: mainError },
        { data: placements, error: placementsError },
        { data: rewardedSettings, error: rewardedError },
      ] = await Promise.all([
        supabase
          .from('merchant_ad_settings')
          .select(
            'enabled, network_code, adsense_id, provider, revenue_share_percent, test_mode, max_ads_per_page, min_content_between_ads, track_impressions, track_clicks, gdpr_compliant, ccpa_compliant, show_ad_labels, created_at, updated_at, ad_tier'
          )
          .eq('merchant_id', merchant.merchant.id)
          .single(),
        supabase
          .from('merchant_ad_placements')
          .select(
            'placement_key, enabled, custom_ad_unit_id, custom_sizes, frequency'
          )
          .eq('merchant_id', merchant.merchant.id),
        supabase
          .from('merchant_rewarded_ad_settings')
          .select(
            'enabled, reward_type, reward_value, reward_expiry_days, min_order_value'
          )
          .eq('merchant_id', merchant.merchant.id)
          .single(),
      ]);

      if (mainError && mainError.code !== 'PGRST116') {
        throw mainError;
      }

      if (placementsError) {
        throw placementsError;
      }

      if (rewardedError && rewardedError.code !== 'PGRST116') {
        throw rewardedError;
      }

      // If no settings exist, use defaults
      if (!mainSettings) {
        setSettings(DEFAULT_AD_SETTINGS);
        setTier('starter');
        setLoading(false);
        return;
      }

      // Merge database data with defaults
      const mergedSettings: AdMonetizationSettings = {
        ...DEFAULT_AD_SETTINGS,
        enabled: mainSettings.enabled,
        credentials: {
          networkCode: mainSettings.network_code || undefined,
          adsenseId: mainSettings.adsense_id || undefined,
          provider: mainSettings.provider || 'adsense',
        },
        placements:
          placements?.map((p) => ({
            placementKey: p.placement_key,
            enabled: p.enabled,
            customAdUnitId: p.custom_ad_unit_id || undefined,
            customSizes: p.custom_sizes || undefined,
            frequency: p.frequency || 1,
          })) || DEFAULT_AD_SETTINGS.placements,
        rewardedAd: rewardedSettings
          ? {
              enabled: rewardedSettings.enabled,
              rewardType: rewardedSettings.reward_type,
              rewardValue: rewardedSettings.reward_value,
              rewardExpiryDays: rewardedSettings.reward_expiry_days,
              minOrderValue: rewardedSettings.min_order_value || undefined,
            }
          : DEFAULT_AD_SETTINGS.rewardedAd,
        revenueSharePercent: mainSettings.revenue_share_percent,
        testMode: mainSettings.test_mode,
        maxAdsPerPage: mainSettings.max_ads_per_page,
        minContentBetweenAds: mainSettings.min_content_between_ads,
        trackImpressions: mainSettings.track_impressions,
        trackClicks: mainSettings.track_clicks,
        gdprCompliant: mainSettings.gdpr_compliant,
        ccpaCompliant: mainSettings.ccpa_compliant,
        showAdLabels: mainSettings.show_ad_labels,
        createdAt: mainSettings.created_at,
        updatedAt: mainSettings.updated_at,
      };

      setSettings(mergedSettings);
      setTier(mainSettings.ad_tier || 'starter');
    } catch (err) {
      console.error('Failed to load ad settings:', err);
      setError('Failed to load ad settings');
      setSettings(DEFAULT_AD_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadSettings is stable across renders
  useEffect(() => {
    loadSettings();
  }, [merchant?.merchant?.id]);

  // Update main settings
  const updateSettings = async (updates: Partial<AdMonetizationSettings>) => {
    if (!merchant?.merchant?.id || !settings) {
      throw new Error('No merchant or settings available');
    }

    const dbUpdates: Record<string, unknown> = {};

    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.credentials) {
      if (updates.credentials.networkCode !== undefined) {
        dbUpdates.network_code = updates.credentials.networkCode;
      }
      if (updates.credentials.adsenseId !== undefined) {
        dbUpdates.adsense_id = updates.credentials.adsenseId;
      }
      if (updates.credentials.provider !== undefined) {
        dbUpdates.provider = updates.credentials.provider;
      }
    }
    if (updates.revenueSharePercent !== undefined) {
      dbUpdates.revenue_share_percent = updates.revenueSharePercent;
    }
    if (updates.testMode !== undefined) dbUpdates.test_mode = updates.testMode;
    if (updates.maxAdsPerPage !== undefined)
      dbUpdates.max_ads_per_page = updates.maxAdsPerPage;
    if (updates.trackImpressions !== undefined)
      dbUpdates.track_impressions = updates.trackImpressions;
    if (updates.trackClicks !== undefined)
      dbUpdates.track_clicks = updates.trackClicks;
    if (updates.showAdLabels !== undefined)
      dbUpdates.show_ad_labels = updates.showAdLabels;

    // Upsert settings
    const { error } = await supabase.from('merchant_ad_settings').upsert(
      {
        merchant_id: merchant.merchant.id,
        ...dbUpdates,
      },
      {
        onConflict: 'merchant_id',
      }
    );

    if (error) {
      throw error;
    }

    // Update local state
    setSettings((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // Update a specific placement
  const updatePlacement = async (
    placementKey: string,
    updates: Partial<AdPlacementSettings>
  ) => {
    if (!merchant?.merchant?.id || !settings) {
      throw new Error('No merchant or settings available');
    }

    // Check if can enable
    if (updates.enabled === true) {
      const currentEnabled = settings.placements.filter(
        (p) => p.enabled
      ).length;
      if (!canEnablePlacement(tier, currentEnabled, placementKey)) {
        throw new Error('Cannot enable more placements on current tier');
      }
    }

    const { error } = await supabase.from('merchant_ad_placements').upsert(
      {
        merchant_id: merchant.merchant.id,
        placement_key: placementKey,
        enabled: updates.enabled,
        custom_ad_unit_id: updates.customAdUnitId,
        custom_sizes: updates.customSizes,
        frequency: updates.frequency,
      },
      {
        onConflict: 'merchant_id,placement_key',
      }
    );

    if (error) {
      throw error;
    }

    // Update local state
    setSettings((prev) => {
      if (!prev) return null;

      const existingIndex = prev.placements.findIndex(
        (p) => p.placementKey === placementKey
      );

      const newPlacements = [...prev.placements];
      if (existingIndex >= 0) {
        newPlacements[existingIndex] = {
          ...newPlacements[existingIndex],
          ...updates,
        };
      } else {
        newPlacements.push({
          placementKey,
          enabled: updates.enabled || false,
          ...updates,
        });
      }

      return { ...prev, placements: newPlacements };
    });
  };

  // Update rewarded ad settings
  const updateRewardedAd = async (updates: Partial<RewardedAdSettings>) => {
    if (!merchant?.merchant?.id || !settings) {
      throw new Error('No merchant or settings available');
    }

    const { error } = await supabase
      .from('merchant_rewarded_ad_settings')
      .upsert(
        {
          merchant_id: merchant.merchant.id,
          enabled: updates.enabled,
          reward_type: updates.rewardType,
          reward_value: updates.rewardValue,
          reward_expiry_days: updates.rewardExpiryDays,
          min_order_value: updates.minOrderValue,
        },
        {
          onConflict: 'merchant_id',
        }
      );

    if (error) {
      throw error;
    }

    setSettings((prev) =>
      prev ? { ...prev, rewardedAd: { ...prev.rewardedAd, ...updates } } : null
    );
  };

  // Enable all allowed placements
  const enableAllPlacements = async () => {
    if (!merchant?.merchant?.id || !settings) return;

    const placementKeys = Object.keys(AD_PLACEMENTS);
    let enabledCount = 0;

    for (const key of placementKeys) {
      if (canEnablePlacement(tier, enabledCount, key)) {
        await updatePlacement(key, { enabled: true });
        enabledCount++;
      }
    }
  };

  // Disable all placements
  const disableAllPlacements = async () => {
    if (!merchant?.merchant?.id || !settings) return;

    for (const placement of settings.placements) {
      if (placement.enabled) {
        await updatePlacement(placement.placementKey, { enabled: false });
      }
    }
  };

  // Helper functions
  const isPlacementEnabled = (placementKey: string): boolean => {
    if (!settings) return false;
    const placement = settings.placements.find(
      (p) => p.placementKey === placementKey
    );
    return placement?.enabled || false;
  };

  const getEnabledPlacementCount = (): number => {
    if (!settings) return 0;
    return settings.placements.filter((p) => p.enabled).length;
  };

  const canEnableMorePlacements = (): boolean => {
    const currentCount = getEnabledPlacementCount();
    return canEnablePlacement(tier, currentCount, 'any');
  };

  const value: AdSettingsContextType = {
    settings,
    loading,
    error,
    tier,
    updateSettings,
    updatePlacement,
    updateRewardedAd,
    enableAllPlacements,
    disableAllPlacements,
    reloadSettings: loadSettings,
    isPlacementEnabled,
    canEnableMorePlacements,
    getEnabledPlacementCount,
  };

  return (
    <AdSettingsContext.Provider value={value}>
      {children}
    </AdSettingsContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAdSettings(): AdSettingsContextType {
  const context = useContext(AdSettingsContext);
  if (context === undefined) {
    throw new Error('useAdSettings must be used within an AdSettingsProvider');
  }
  return context;
}

/**
 * Safe version that returns null outside provider (for storefronts)
 */
export function useAdSettingsSafe(): AdSettingsContextType | null {
  const context = useContext(AdSettingsContext);
  return context === undefined ? null : context;
}
