'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Loyalty Program Types
 */
export interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  points_cost: number;
  reward_type: 'discount_percentage' | 'discount_fixed' | 'free_shipping' | 'free_product' | 'store_credit';
  reward_value?: number;
  reward_product_id?: string;
  stock_quantity?: number | null;
  minimum_order_amount?: number;
  start_date?: string;
  end_date?: string;
}

export interface PointsTransaction {
  id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire';
  points: number;
  balance_after: number;
  source: string;
  description: string;
  created_at: string;
}

export interface LoyaltySettings {
  programName: string;
  pointsPerCurrency: number;
  pointsCurrencyUnit: number;
  pointsToCurrencyRatio: number;
  minimumRedemptionPoints: number;
  maximumRedemptionPercentage: number;
  tiers: LoyaltyTier[];
}

export interface LoyaltyStatus {
  isEnrolled: boolean;
  pointsBalance: number;
  lifetimePoints: number;
  currentTier: string | null;
  currentTierInfo?: LoyaltyTier;
  nextTier?: LoyaltyTier | null;
  pointsToNextTier?: number | null;
  referralCode: string | null;
  availableRewards: LoyaltyReward[];
  recentTransactions: PointsTransaction[];
  settings: LoyaltySettings | null;
  message?: string;
}

export interface RedemptionResult {
  success: boolean;
  redemption?: {
    id: string;
    code: string;
    reward: string;
    pointsSpent: number;
    newBalance: number;
    details: Record<string, unknown>;
  };
  error?: string;
}

export interface EnrollmentResult {
  success: boolean;
  enrollment?: {
    customerId: string;
    pointsBalance: number;
    referralCode: string;
    tier: string;
    signupBonus: number;
    referralBonus: number;
  };
  settings?: {
    programName: string;
    tiers: LoyaltyTier[];
  };
  error?: string;
}

interface UseLoyaltyOptions {
  merchantId: string;
  customerEmail?: string;
  autoFetch?: boolean;
}

/**
 * Hook for customer loyalty program interactions
 */
export function useLoyalty({ merchantId, customerEmail, autoFetch = true }: UseLoyaltyOptions) {
  const [data, setData] = useState<LoyaltyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  /**
   * Fetch loyalty data
   */
  const fetchLoyaltyData = useCallback(async () => {
    if (!merchantId || !customerEmail) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/storefront/loyalty?merchantId=${merchantId}&email=${encodeURIComponent(customerEmail)}`
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch loyalty data');
        return;
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loyalty data');
    } finally {
      setIsLoading(false);
    }
  }, [merchantId, customerEmail]);

  // Auto-fetch on mount and when email changes
  useEffect(() => {
    if (autoFetch && merchantId && customerEmail) {
      fetchLoyaltyData();
    }
  }, [autoFetch, merchantId, customerEmail, fetchLoyaltyData]);

  /**
   * Enroll in the loyalty program
   */
  const enroll = useCallback(
    async (
      email: string,
      options?: { name?: string; phone?: string; referralCode?: string }
    ): Promise<EnrollmentResult> => {
      setIsEnrolling(true);
      try {
        const response = await fetch('/api/storefront/loyalty/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            email,
            ...options,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        // Refresh loyalty data
        fetchLoyaltyData();

        return { success: true, ...result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to enroll',
        };
      } finally {
        setIsEnrolling(false);
      }
    },
    [merchantId, fetchLoyaltyData]
  );

  /**
   * Redeem a reward
   */
  const redeemReward = useCallback(
    async (rewardId: string, email: string): Promise<RedemptionResult> => {
      setIsRedeeming(true);
      try {
        const response = await fetch('/api/storefront/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId,
            email,
            rewardId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        // Refresh loyalty data
        fetchLoyaltyData();

        return { success: true, ...result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to redeem reward',
        };
      } finally {
        setIsRedeeming(false);
      }
    },
    [merchantId, fetchLoyaltyData]
  );

  /**
   * Calculate points earned for a purchase amount
   */
  const calculatePointsEarned = useCallback(
    (purchaseAmount: number): number => {
      if (!data?.settings) return 0;
      const { pointsPerCurrency, pointsCurrencyUnit } = data.settings;
      const tierMultiplier = data.currentTierInfo?.multiplier || 1;
      return Math.floor((purchaseAmount / pointsCurrencyUnit) * pointsPerCurrency * tierMultiplier);
    },
    [data]
  );

  /**
   * Calculate the value of points in currency
   */
  const calculatePointsValue = useCallback(
    (points: number): number => {
      if (!data?.settings) return 0;
      return points * data.settings.pointsToCurrencyRatio;
    },
    [data]
  );

  /**
   * Check if customer can redeem a reward
   */
  const canRedeemReward = useCallback(
    (reward: LoyaltyReward): { canRedeem: boolean; reason?: string } => {
      if (!data) return { canRedeem: false, reason: 'Loading loyalty data' };
      if (!data.isEnrolled) return { canRedeem: false, reason: 'Not enrolled in loyalty program' };

      if (data.pointsBalance < reward.points_cost) {
        return {
          canRedeem: false,
          reason: `Need ${reward.points_cost - data.pointsBalance} more points`,
        };
      }

      if (reward.stock_quantity !== undefined && reward.stock_quantity !== null && reward.stock_quantity <= 0) {
        return { canRedeem: false, reason: 'Out of stock' };
      }

      const now = new Date();
      if (reward.start_date && new Date(reward.start_date) > now) {
        return { canRedeem: false, reason: 'Not yet available' };
      }
      if (reward.end_date && new Date(reward.end_date) < now) {
        return { canRedeem: false, reason: 'Expired' };
      }

      return { canRedeem: true };
    },
    [data]
  );

  /**
   * Get progress to next tier
   */
  const getTierProgress = useCallback((): {
    currentTier: string;
    nextTier: string | null;
    progress: number;
    pointsNeeded: number;
  } | null => {
    if (!data?.settings || !data.currentTier) return null;

    const currentTier = data.currentTier;
    const nextTier = data.nextTier;

    if (!nextTier) {
      return {
        currentTier,
        nextTier: null,
        progress: 100,
        pointsNeeded: 0,
      };
    }

    const currentTierMin = data.currentTierInfo?.minPoints || 0;
    const nextTierMin = nextTier.minPoints;
    const totalRange = nextTierMin - currentTierMin;
    const currentProgress = data.lifetimePoints - currentTierMin;
    const progress = Math.min(100, Math.floor((currentProgress / totalRange) * 100));

    return {
      currentTier,
      nextTier: nextTier.name,
      progress,
      pointsNeeded: data.pointsToNextTier || 0,
    };
  }, [data]);

  return {
    // Status
    status: data || null,
    isLoading,
    error,
    isEnrolled: data?.isEnrolled || false,
    pointsBalance: data?.pointsBalance || 0,
    lifetimePoints: data?.lifetimePoints || 0,
    currentTier: data?.currentTier || null,
    referralCode: data?.referralCode || null,
    availableRewards: data?.availableRewards || [],
    recentTransactions: data?.recentTransactions || [],
    settings: data?.settings || null,

    // Actions
    enroll,
    redeemReward,
    refresh: fetchLoyaltyData,

    // Loading states
    isEnrolling,
    isRedeeming,

    // Utilities
    calculatePointsEarned,
    calculatePointsValue,
    canRedeemReward,
    getTierProgress,
  };
}

export default useLoyalty;
