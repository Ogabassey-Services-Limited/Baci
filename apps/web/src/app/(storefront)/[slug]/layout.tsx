import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type React from 'react';
import { Suspense } from 'react';
import { DeferredPageViewTracker } from '@/components/storefront/deferred-page-view-tracker';
import { OgabasseyStorefrontLayout } from '@/components/storefront/ogabassey/storefront-layout';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { MOBILE_APPS } from '@/config/platform';
import { StorefrontCartProvider } from '@/hooks/cart/storefront-cart-provider';
import { StorefrontMerchantProvider } from '@/hooks/merchant/storefront-merchant-provider';
import type { MerchantData } from '@/hooks/use-merchant';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import { StorefrontLayoutFallback } from './storefront-layout-fallback';

/**
 * Renders the appropriate layout wrapper based on the merchant's template.
 * Currently supports 'ogabassey' template with persistent layout.
 */
function StorefrontLayoutRenderer({
  merchant,
  children,
}: {
  merchant: MerchantData;
  children: React.ReactNode;
}) {
  // Theme is handled client-side by V2ThemeProvider (reads cookie on mount).
  // Trade-off: removing server-side theme detection (cookies()) enables PPR static shells
  // but may cause a single-frame flash when seasonal themes (e.g., santa in December)
  // differ from the 'standard' default. SnowEffect uses fixed inset-0 pointer-events-none,
  // so there is zero CLS impact. The flash is imperceptible in practice.
  // hideNavigation is computed in the smaller client chrome via usePathname().
  const templateId = merchant.template_id;

  if (templateId === 'ogabassey') {
    return (
      <OgabasseyStorefrontLayout merchant={merchant}>
        {children}
      </OgabasseyStorefrontLayout>
    );
  }

  // Default / other templates: No global layout wrapper (layout handled per page)
  return <>{children}</>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Validate identifier format
  if (!isValidMerchantIdentifier(slug)) {
    return { title: 'Store Not Found' };
  }

  // Fetch merchant data (returns CachedMerchant | null)
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return { title: 'Store Not Found' };
  }

  // Extract verification code from feature settings or published config
  // Prioritize feature_settings, check published_config fallback
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic merchant config structure
  const merchantConfig = merchant as any;
  const featureSettings = merchantConfig.feature_settings as
    | Record<string, unknown>
    | undefined;
  const publishedConfig = merchantConfig.published_config as
    | Record<string, unknown>
    | undefined;

  const rawVerification =
    featureSettings?.google_site_verification ||
    publishedConfig?.google_site_verification;
  const verificationCode =
    typeof rawVerification === 'string' ? rawVerification : undefined;

  // Build icons configuration for merchant favicon
  // Fall back to logo_url if no dedicated favicon exists
  const faviconSvg = merchant.favicon_svg_url;
  const faviconPng32 = merchant.favicon_png_32_url;
  const faviconAppleTouch = merchant.favicon_apple_touch_url;

  // Build icons array only if merchant has custom favicons
  // Build icons array only if merchant has custom favicons
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

  // Build SEO-friendly description with proper fallbacks
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Shop ${merchant.business_name} - Buy gadgets, electronics, and more with flexible payment options in Nigeria.`;
  const headersList = await headers();
  const baseUrl = buildRequestScopedStoreUrl(merchant, headersList);
  let metadataBase: URL | undefined;

  try {
    metadataBase = baseUrl ? new URL(baseUrl) : undefined;
  } catch {
    metadataBase = undefined;
  }

  return {
    metadataBase,
    title:
      merchant.site_title ||
      `${merchant.business_name} | Buy Gadgets Pay Later`,
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
      images: merchant.logo_url ? [merchant.logo_url] : [],
    },
    // Apple Smart App Banner — prompts iOS Safari users to open/install the app
    ...(MOBILE_APPS.storefront.iosAppId
      ? {
          other: {
            'apple-itunes-app': `app-id=${MOBILE_APPS.storefront.iosAppId}`,
          },
        }
      : {}),
    // Disable platform manifest for merchant stores to prevent Baci branding leakage
    manifest: null,
  };
}

/**
 * Next.js 16+ Viewport Configuration
 * 2026 Best Practice: Static viewport for PPR compatibility
 * Dynamic theme colors are applied via meta tag in the layout component
 */
export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
  };
}

async function StorefrontLayoutContent({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate identifier format (can be slug or domain)
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  // Use appropriate lookup method based on identifier type
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if store is published - show "coming soon" page if not
  // In development, allow viewing unpublished stores for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  // Use the merchant's actual slug for internal routing, not the domain
  const merchantSlug = merchant.slug;

  // Determine routing mode and checkout state based on headers (set by middleware)
  const headersList = await headers();
  const hasSubdomain = headersList.has('x-merchant-slug');
  const hasCustomDomain = headersList.has('x-custom-domain');

  // Use headers but fall back to slug format checking if headers are missing (e.g. some SSR scenarios)
  const routingMode =
    hasSubdomain || hasCustomDomain || isDomainIdentifier(slug)
      ? 'domain'
      : 'path';

  // Fetch navigation categories server-side (cached)
  const navigationCategories = await getCachedNavigationCategories(merchant.id);

  return (
    <StorefrontMerchantProvider
      slug={merchantSlug}
      initialMerchant={merchant as unknown as MerchantData}
      initialRoutingMode={routingMode}
      navigationCategories={navigationCategories}
    >
      <StorefrontCartProvider
        enableSmartCartPro
        merchantSlug={merchantSlug}
        deferValidationUntilIdle
      >
        <DeferredPageViewTracker merchantId={merchant.id} />
        {/*
          Global Layout Wrapper logic:
          - Keeps layout persistent across route changes (seamless navigation)
          - Prevents header flashing/re-rendering
        */}
        <StorefrontLayoutRenderer
          merchant={merchant as unknown as MerchantData}
        >
          {children}
        </StorefrontLayoutRenderer>
      </StorefrontCartProvider>
    </StorefrontMerchantProvider>
  );
}

export default async function StorefrontLayout(props: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const [headersList, { slug }] = await Promise.all([headers(), props.params]);
  const pathname = headersList.get('x-pathname');

  return (
    <Suspense
      fallback={<StorefrontLayoutFallback pathname={pathname} slug={slug} />}
    >
      <StorefrontLayoutContent {...props} />
    </Suspense>
  );
}
