import type { User } from '@supabase/supabase-js';
import { useEffect } from 'react';
import type { Merchant } from '@/hooks/useMerchant';
import {
  identifyAdminUser,
  resetAdminAnalytics,
} from '@/services/analytics-core';

function runAdminAnalyticsSync(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (__DEV__) {
      console.warn('[PostHog] Failed to sync admin analytics:', error);
    }
  }
}

export function useAdminAnalyticsSync(
  user: User | null,
  merchant: Merchant | null
): void {
  useEffect(() => {
    if (!user?.id) {
      runAdminAnalyticsSync(resetAdminAnalytics);
      return;
    }

    runAdminAnalyticsSync(() => {
      identifyAdminUser(user.id, {
        isPublished: merchant?.is_published ?? null,
        merchantId: merchant?.id ?? null,
        planTier: merchant?.plan_tier ?? null,
      });
    });
  }, [user?.id, merchant?.id, merchant?.is_published, merchant?.plan_tier]);
}
