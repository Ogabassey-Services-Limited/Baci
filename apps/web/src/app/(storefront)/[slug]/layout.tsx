import type { Metadata, Viewport } from 'next';
import '@/app/(storefront)/storefront-globals.css';
import { notFound } from 'next/navigation';
import type React from 'react';
import { Suspense } from 'react';
import { DeferredPageViewTracker } from '@/components/storefront/deferred-page-view-tracker';
import { OgabasseyStorefrontLayout } from '@/components/storefront/ogabassey/storefront-layout';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { StorefrontThemeProvider } from '@/components/storefront/storefront-theme-provider';
import { MOBILE_APPS } from '@/config/platform';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { StorefrontCartProvider } from '@/hooks/cart/storefront-cart-provider';
import { StorefrontMerchantProvider } from '@/hooks/merchant/storefront-merchant-provider';
import type { MerchantData } from '@/hooks/merchant/types';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { isValidMerchantIdentifier } from '@/lib/validation';
import {
  getStorefrontSeoDescription,
  getStorefrontSeoTitle,
} from './seo-helpers';
import {
  getStorefrontShellSnapshot,
  getStorefrontShellSnapshotBase,
} from './storefront-shell-snapshot';

/**
 * Renders the appropriate layout wrapper based on the merchant's template.
 * Currently supports 'ogabassey' template with persistent layout.
 */
function StorefrontLayoutRenderer({
  merchant,
  preloadHeroLcpImages,
  routingMode,
  children,
}: {
  merchant: MerchantData;
  preloadHeroLcpImages: boolean;
  routingMode: 'domain' | 'path';
  children: React.ReactNode;
}) {
  // Theme is handled client-side by V2ThemeProvider (reads cookie on mount).
  // Trade-off: removing server-side theme detection (cookies()) enables PPR static shells
  // but may cause a single-frame flash when seasonal themes (e.g., santa in December)
  // differ from the 'standard' default. SnowEffect uses fixed inset-0 pointer-events-none,
  // so there is zero CLS impact. The flash is imperceptible in practice.
  // hideNavigation resolves inside `OgabasseyLayoutChrome` (a client
  // component) via `usePathname()`, so route-based hide state stays
  // reactive across client-side routing. The `hideNavigation` prop on
  // this layout is kept as an override-only escape hatch.
  const templateId = merchant.template_id;

  if (templateId === OGABASSEY_TEMPLATE_ID) {
    return (
      <OgabasseyStorefrontLayout
        merchant={merchant}
        preloadHeroLcpImages={preloadHeroLcpImages}
        routingMode={routingMode}
      >
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

  // Extract verification code from feature settings or published config.
  // feature_settings is normalized in cached-data; published_config is optional.
  const featureSettings = merchant.feature_settings;
  const publishedConfig = merchant.published_config;

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
    title: getStorefrontSeoTitle(merchant),
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

function StorefrontShellFrame({
  children,
  preloadHeroLcpImages,
  shellSnapshot,
}: {
  children: React.ReactNode;
  preloadHeroLcpImages: boolean;
  shellSnapshot: Awaited<ReturnType<typeof getStorefrontShellSnapshot>>;
}) {
  if (!shellSnapshot) {
    notFound();
  }

  const { merchant, routingMode } = shellSnapshot;
  const merchantSlug = merchant.slug || '';

  return (
    <StorefrontMerchantProvider
      slug={merchantSlug}
      shellSnapshot={shellSnapshot}
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
          merchant={merchant}
          preloadHeroLcpImages={preloadHeroLcpImages}
          routingMode={routingMode}
        >
          {children}
        </StorefrontLayoutRenderer>
      </StorefrontCartProvider>
    </StorefrontMerchantProvider>
  );
}

function StorefrontThemeFrame({ children }: { children: React.ReactNode }) {
  return <StorefrontThemeProvider>{children}</StorefrontThemeProvider>;
}

export async function StorefrontLayoutContent(props: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const shellSnapshotBase = await getStorefrontShellSnapshotBase(slug);

  if (!shellSnapshotBase) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!shellSnapshotBase.merchant.is_published && !isDevelopment) {
    return (
      <StoreNotPublished
        businessName={shellSnapshotBase.merchant.business_name}
      />
    );
  }

  const shellSnapshot = await getStorefrontShellSnapshot(shellSnapshotBase);

  if (!shellSnapshot) {
    notFound();
  }

  return (
    <StorefrontShellFrame
      // Page-level resource hints own LCP preloads. Keeping the shared
      // layout disabled prevents home hero hints from leaking onto nested routes.
      preloadHeroLcpImages={false}
      shellSnapshot={shellSnapshot}
    >
      {props.children}
    </StorefrontShellFrame>
  );
}

export default function StorefrontLayout(props: {
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { loadingFallback = null, ...contentProps } = props;

  return (
    <StorefrontThemeFrame>
      <Suspense fallback={loadingFallback}>
        <StorefrontLayoutContent {...contentProps} />
      </Suspense>
    </StorefrontThemeFrame>
  );
}
