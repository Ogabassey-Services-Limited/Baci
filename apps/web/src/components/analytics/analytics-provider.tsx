'use client';

import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { buildMerchantAnalyticsSettings } from './analytics-merchant-settings';
import {
  AnalyticsPixelProvider,
  type MerchantWithAnalytics,
} from './analytics-pixel-provider';

/**
 * Analytics Provider Component
 *
 * Renders analytics scripts based on merchant settings.
 * Supports: Google Analytics 4, Facebook, TikTok, Snapchat, Twitter/X
 *
 * All pixels respect cookie consent - scripts only load when appropriate consent is given.
 * Server-side APIs (CAPI/Events API) are handled separately via API routes.
 *
 * Merchant settings should include:
 * - google_analytics_id: GA4 Measurement ID (e.g., "G-XXXXXXXXXX")
 * - facebook_pixel_id: FB Pixel ID (e.g., "1234567890")
 * - tiktok_pixel_id: TikTok Pixel ID (e.g., "CTXXXXXX")
 * - snapchat_pixel_id: Snapchat Pixel ID (e.g., "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
 * - twitter_pixel_id: Twitter Pixel ID (e.g., "oxxxx")
 */

interface AnalyticsProviderProps {
  merchant?: MerchantWithAnalytics | null;
}

export function AnalyticsProvider({ merchant }: AnalyticsProviderProps = {}) {
  const merchantContext = useMerchantSafe();

  // Get analytics IDs from merchant settings
  const merchantData = buildMerchantAnalyticsSettings(
    merchant || merchantContext?.merchant || null
  );

  return <AnalyticsPixelProvider merchant={merchantData} />;
}
