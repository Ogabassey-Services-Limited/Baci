import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type React from 'react';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { OgabasseyLayout } from '@/components/storefront/ogabassey/layout';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { PageViewTracker } from '@/components/storefront/page-view-tracker';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

/**
 * Static shell for storefront - renders immediately while dynamic content loads
 * 2026 Best Practice: Static shell outside Suspense for PPR (Partial Pre-Rendering)
 */
function StorefrontShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Renders the appropriate layout wrapper based on the merchant's template.
 * Now uses client-side theme detection to avoid cookies() in server component.
 */
function StorefrontLayoutRenderer({
  merchant,
  children,
}: {
  merchant: MerchantData;
  slug: string;
  children: React.ReactNode;
}) {
  // Theme detection moved to client-side in OgabasseyLayout for PPR compatibility
  // Dynamic default based on date to match client-side logic in v2-theme-context.tsx
  const isDecember = new Date().getMonth() === 11;
  const defaultTheme: V2ThemeMode = isDecember ? 'santa' : 'standard';

  const templateId = merchant.template_id;

  if (templateId === 'ogabassey') {
    return (
      <OgabasseyLayout
        merchant={merchant}
        initialTheme={defaultTheme}
        // Navigation hiding now handled client-side via usePathname()
        hideNavigation={false}
      >
        {children}
      </OgabasseyLayout>
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
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'Store Not Found' };
  }

  // Extract verification code from feature settings or published config
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

  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Shop ${merchant.business_name} - Buy gadgets, electronics, and more with flexible payment options in Nigeria.`;

  return {
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
    manifest: null,
  };
}

/**
 * Viewport Configuration
 * 2026 Best Practice: Static viewport to avoid blocking page prerendering.
 * Dynamic theme color is handled client-side via meta tag updates if needed.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0F' },
  ],
};

/**
 * Storefront Layout - 2026 PPR Pattern
 * Uses cached merchant data, defers dynamic operations to client-side
 */
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

  // Use cached merchant lookup
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  // Check if store is published - show "coming soon" page if not
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  const merchantSlug = merchant.slug;

  // Derive routing mode from slug format (no headers() needed)
  // If slug looks like a domain, use domain mode; otherwise use path mode
  const routingMode = isDomainIdentifier(slug) ? 'domain' : 'path';

  // Fetch navigation categories (cached)
  const navigationCategories = await getCachedNavigationCategories(merchant.id);

  return (
    <StorefrontShell>
      <MerchantProvider
        slug={merchantSlug}
        initialMerchant={merchant as unknown as MerchantData}
        initialRoutingMode={routingMode}
        navigationCategories={navigationCategories}
      >
        <CartProvider enableSmartCartPro merchantSlug={merchantSlug}>
          <MerchantSlugSync slug={merchantSlug} />
          <PageViewTracker merchantId={merchant.id} />
          <StorefrontLayoutRenderer
            merchant={merchant as unknown as MerchantData}
            slug={slug}
          >
            {children}
          </StorefrontLayoutRenderer>
        </CartProvider>
      </MerchantProvider>
    </StorefrontShell>
  );
}
