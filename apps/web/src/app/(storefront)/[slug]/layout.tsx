import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type React from 'react';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { OgabasseyLayout } from '@/components/storefront/ogabassey/layout';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { PageViewTracker } from '@/components/storefront/page-view-tracker';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

/**
 * Renders the appropriate layout wrapper based on the merchant's template.
 * Currently supports 'ogabassey' template with persistent layout.
 */
async function StorefrontLayoutRenderer({
  merchant,
  children,
  hideNavigation,
}: {
  merchant: MerchantData;
  slug: string; // identifier used
  children: React.ReactNode;
  hideNavigation: boolean;
}) {
  // Read theme cookie server-side for SSR consistency
  // CRITICAL: Always provide a theme value to avoid hydration mismatch
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme-v2')?.value;

  // Dynamic default based on date to match client-side logic in v2-theme-context.tsx
  const isDecember = new Date().getMonth() === 11;
  const defaultTheme: V2ThemeMode = isDecember ? 'santa' : 'standard';

  const initialTheme: V2ThemeMode =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? (themeCookie as V2ThemeMode)
      : defaultTheme;

  const templateId = merchant.template_id;

  if (templateId === 'ogabassey') {
    return (
      <OgabasseyLayout
        merchant={merchant}
        initialTheme={initialTheme}
        hideNavigation={hideNavigation}
      >
        {children}
      </OgabasseyLayout>
    );
  }

  // Default / other templates: No global layout wrapper (layout handled per page)
  return <>{children}</>;
}

// Valid slug/domain patterns and reserved paths are now imported from @/lib/validation

import { getCachedNavigationCategories } from '@/lib/cached-categories';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate identifier format
  if (!isValidMerchantIdentifier(slug)) {
    return { title: 'Store Not Found' };
  }

  // Fetch merchant data (returns CachedMerchant | null)
  let merchant = null as Awaited<ReturnType<typeof getCachedMerchant>> | null;
  if (isDomainIdentifier(slug)) {
    merchant = await getCachedMerchantByDomain(slug.toLowerCase());
  } else {
    merchant = await getCachedMerchant(slug.toLowerCase());
  }

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

  const verificationCode =
    featureSettings?.google_site_verification ||
    publishedConfig?.google_site_verification;

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

  // Determine theme color for browser UI (prevent flashes)
  const isDarkTemplate =
    merchant.template_id === 'ogabassey' ||
    merchant.template_id === 'classic-elegant';
  const themeColor = isDarkTemplate ? '#0F0F0F' : '#ffffff';

  return {
    title:
      merchant.site_title ||
      `${merchant.business_name} | Buy Gadgets Pay Later`,
    description,
    icons,
    themeColor,
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
    // Disable platform manifest for merchant stores to prevent Baci branding leakage
    manifest: null,
    other: {
      'theme-color': themeColor,
    },
  };
}

export default async function StorefrontLayout({
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
  type MerchantResult = Awaited<ReturnType<typeof getCachedMerchant>>;
  let merchant: MerchantResult;

  if (isDomainIdentifier(slug)) {
    // Custom domain access (e.g., ogabassey.com) - normalize to lowercase
    merchant = await getCachedMerchantByDomain(slug.toLowerCase());
  } else {
    // Standard slug access (e.g., ogabassey) - normalize to lowercase
    merchant = await getCachedMerchant(slug.toLowerCase());
  }

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

  // Detect key pages where navigation should be hidden (Checkout, Auth, Account Login)
  const pathname = headersList.get('x-pathname') || '';
  const isCheckout = pathname.includes('/checkout');
  const isAuthPage =
    pathname.includes('/account/login') ||
    pathname.includes('/track-order') || // Tracking often minimal
    pathname.includes('/auth/'); // Future proofing

  const hideNavigation = isCheckout || isAuthPage;

  // Fetch navigation categories server-side (cached)
  const navigationCategories = await getCachedNavigationCategories(merchant.id);

  return (
    <MerchantProvider
      slug={merchantSlug}
      initialMerchant={merchant as unknown as MerchantData}
      initialRoutingMode={routingMode}
      navigationCategories={navigationCategories}
    >
      <CartProvider enableSmartCartPro merchantSlug={merchantSlug}>
        <MerchantSlugSync slug={merchantSlug} />
        <PageViewTracker merchantId={merchant.id} />
        {/*
          Global Layout Wrapper logic:
          - Keeps layout persistent across route changes (seamless navigation)
          - Prevents header flashing/re-rendering
        */}
        <StorefrontLayoutRenderer
          merchant={merchant as unknown as MerchantData}
          slug={slug}
          hideNavigation={hideNavigation}
        >
          {children}
        </StorefrontLayoutRenderer>
      </CartProvider>
    </MerchantProvider>
  );
}
