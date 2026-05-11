'use client';

import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { FacebookPixel } from './facebook-pixel';
import { GoogleAnalytics } from './google-analytics';
import { SnapchatPixel } from './snapchat-pixel';
import { TikTokPixel } from './tiktok-pixel';
import { TwitterPixel } from './twitter-pixel';

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

interface MerchantWithAnalytics {
  google_analytics_id?: string;
  facebook_pixel_id?: string;
  tiktok_pixel_id?: string;
  snapchat_pixel_id?: string;
  twitter_pixel_id?: string;
}

interface AnalyticsProviderProps {
  merchant?: MerchantWithAnalytics | null;
}

export function AnalyticsProvider({ merchant }: AnalyticsProviderProps = {}) {
  const merchantContext = useMerchantSafe();

  // Get analytics IDs from merchant settings
  const merchantData =
    merchant || (merchantContext?.merchant as MerchantWithAnalytics | null);
  const gaId = merchantData?.google_analytics_id;
  const fbPixelId = merchantData?.facebook_pixel_id;
  const tiktokPixelId = merchantData?.tiktok_pixel_id;
  const snapchatPixelId = merchantData?.snapchat_pixel_id;
  const twitterPixelId = merchantData?.twitter_pixel_id;

  return (
    <>
      {gaId && <GoogleAnalytics measurementId={gaId} />}
      {fbPixelId && <FacebookPixel pixelId={fbPixelId} />}
      {tiktokPixelId && <TikTokPixel pixelId={tiktokPixelId} />}
      {snapchatPixelId && <SnapchatPixel pixelId={snapchatPixelId} />}
      {twitterPixelId && <TwitterPixel pixelId={twitterPixelId} />}
    </>
  );
}
