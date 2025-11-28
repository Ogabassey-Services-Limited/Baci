'use client';

import { GoogleAnalytics } from './google-analytics';
import { FacebookPixel } from './facebook-pixel';
import { useMerchant } from '@/hooks/use-merchant';

/**
 * Analytics Provider Component
 *
 * Renders Google Analytics and Facebook Pixel scripts based on merchant settings.
 * Respects cookie consent - scripts only load when analytics consent is given.
 *
 * Merchant settings should include:
 * - google_analytics_id: GA4 Measurement ID (e.g., "G-XXXXXXXXXX")
 * - facebook_pixel_id: FB Pixel ID (e.g., "1234567890")
 */
export function AnalyticsProvider() {
    const { merchant } = useMerchant();

    // Get analytics IDs from merchant settings
    const gaId = (merchant as { google_analytics_id?: string } | null)?.google_analytics_id;
    const fbPixelId = (merchant as { facebook_pixel_id?: string } | null)?.facebook_pixel_id;

    return (
        <>
            {gaId && <GoogleAnalytics measurementId={gaId} />}
            {fbPixelId && <FacebookPixel pixelId={fbPixelId} />}
        </>
    );
}
