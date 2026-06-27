import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/(storefront)/storefront-home-critical.css';
import StorefrontLayout, {
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { OGABASSEY_STOREFRONT_IOS_APP_ID } from '@/config/platform';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { getStorefrontSeoDescription } from '../[slug]/seo-helpers';
import { OgabasseyHomeShellFallback } from './ogabassey-home-shell-fallback';
import { OgabasseyStaticResourceHints } from './ogabassey-static-resource-hints';

// Co-locate with the Supabase primary (eu-west-1 / Dublin) — route handlers
// and sibling layouts do not inherit the [slug] layout preferredRegion.
export const preferredRegion = 'dub1';

const OGABASSEY_PARAMS = Promise.resolve({ slug: OGABASSEY_TEMPLATE_ID });

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  const merchant = await getRequestScopedMerchant(OGABASSEY_TEMPLATE_ID);
  if (!merchant) {
    return {
      title: 'OgaBassey - Official Online Store',
      description: 'OgaBassey Storefront',
      other: {
        'apple-itunes-app': `app-id=${OGABASSEY_STOREFRONT_IOS_APP_ID}`,
      },
      manifest: null,
    };
  }

  // Extract verification code from feature settings or published config
  const featureSettings = merchant.feature_settings;
  const publishedConfig = merchant.published_config;

  const rawVerification =
    featureSettings?.google_site_verification ||
    publishedConfig?.google_site_verification;
  const verificationCode =
    typeof rawVerification === 'string' ? rawVerification : undefined;

  // Build icons configuration for merchant favicon
  const faviconSvg = merchant.favicon_svg_url;
  const faviconPng32 = merchant.favicon_png_32_url;
  const faviconAppleTouch = merchant.favicon_apple_touch_url;

  const icons =
    faviconSvg || faviconPng32 || faviconAppleTouch
      ? {
          icon: [
            ...(faviconSvg ? [{ url: faviconSvg, type: 'image/svg+xml' }] : []),
            ...(faviconPng32
              ? [{ url: faviconPng32, sizes: '32x32', type: 'image/png' }]
              : []),
          ].filter(Boolean),
          apple: faviconAppleTouch
            ? [{ url: faviconAppleTouch, sizes: '180x180', type: 'image/png' }]
            : undefined,
        }
      : merchant.logo_url
        ? {
            icon: [{ url: merchant.logo_url }],
            apple: [{ url: merchant.logo_url }],
          }
        : undefined;

  const description = getStorefrontSeoDescription(merchant);
  const baseUrl = buildStoreUrl(merchant);
  let metadataBase: URL | undefined;

  try {
    metadataBase = baseUrl ? new URL(baseUrl) : undefined;
  } catch {
    metadataBase = undefined;
  }

  return {
    metadataBase,
    description,
    icons,
    verification: verificationCode
      ? {
          google: verificationCode,
        }
      : undefined,
    openGraph: {
      title: merchant.site_title || merchant.business_name,
      description,
      images: merchant.logo_url ? [{ url: merchant.logo_url }] : [],
      url: baseUrl || undefined,
      type: 'website',
      siteName: merchant.business_name || 'OgaBassey',
    },
    twitter: {
      card: 'summary_large_image',
      description,
      images: merchant.logo_url ? [merchant.logo_url] : [],
    },
    other: {
      'apple-itunes-app': `app-id=${OGABASSEY_STOREFRONT_IOS_APP_ID}`,
    },
    // Disable platform manifest for merchant stores to prevent Baci branding leakage
    manifest: null,
  };
}

export default function OgabasseyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OgabasseyStaticResourceHints />
      <StorefrontLayout
        loadingFallback={<OgabasseyHomeShellFallback />}
        params={OGABASSEY_PARAMS}
      >
        {children}
      </StorefrontLayout>
    </>
  );
}
