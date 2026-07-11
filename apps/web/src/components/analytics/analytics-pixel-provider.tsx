'use client';

import dynamic from 'next/dynamic';
import { normalizeAnalyticsId } from './analytics-id';

// Each third-party pixel wrapper is loaded on-demand via `next/dynamic` so only
// the pixels a merchant has actually configured ship JS to the browser. Before
// this split, the provider statically imported all five wrappers, so every
// storefront (including OgaBassey, which configures few or none) paid for the
// Facebook/GA/TikTok/Snapchat/Twitter wrapper modules in its eager client graph.
// The wrappers only ever render a consent-gated `next/script strategy="lazyOnload"`
// tag and render `null` on the server (consent snapshot is `false`), so `ssr:
// false` here is behaviourally identical — the pixel scripts still fire after
// load once consent is granted — while keeping the modules out of the boot path.
// Defined at module scope so the dynamic `import()` never appears in a component
// body (which would block React Compiler memoization).
const GoogleAnalytics = dynamic(
  () => import('./google-analytics').then((mod) => mod.GoogleAnalytics),
  { ssr: false }
);
const FacebookPixel = dynamic(
  () => import('./facebook-pixel').then((mod) => mod.FacebookPixel),
  { ssr: false }
);
const TikTokPixel = dynamic(
  () => import('./tiktok-pixel').then((mod) => mod.TikTokPixel),
  { ssr: false }
);
const SnapchatPixel = dynamic(
  () => import('./snapchat-pixel').then((mod) => mod.SnapchatPixel),
  { ssr: false }
);
const TwitterPixel = dynamic(
  () => import('./twitter-pixel').then((mod) => mod.TwitterPixel),
  { ssr: false }
);

export interface MerchantWithAnalytics {
  google_analytics_id?: string | null;
  facebook_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  snapchat_pixel_id?: string | null;
  twitter_pixel_id?: string | null;
}

interface AnalyticsPixelProviderProps {
  merchant?: MerchantWithAnalytics | null;
}

export function AnalyticsPixelProvider({
  merchant,
}: AnalyticsPixelProviderProps) {
  const gaId = normalizeAnalyticsId(merchant?.google_analytics_id);
  const fbPixelId = normalizeAnalyticsId(merchant?.facebook_pixel_id);
  const tiktokPixelId = normalizeAnalyticsId(merchant?.tiktok_pixel_id);
  const snapchatPixelId = normalizeAnalyticsId(merchant?.snapchat_pixel_id);
  const twitterPixelId = normalizeAnalyticsId(merchant?.twitter_pixel_id);

  return (
    <>
      {gaId ? <GoogleAnalytics measurementId={gaId} /> : null}
      {fbPixelId ? <FacebookPixel pixelId={fbPixelId} /> : null}
      {tiktokPixelId ? <TikTokPixel pixelId={tiktokPixelId} /> : null}
      {snapchatPixelId ? <SnapchatPixel pixelId={snapchatPixelId} /> : null}
      {twitterPixelId ? <TwitterPixel pixelId={twitterPixelId} /> : null}
    </>
  );
}
