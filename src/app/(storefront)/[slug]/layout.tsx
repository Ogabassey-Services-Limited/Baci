import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type React from 'react';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { OgabasseyLayout } from '@/components/storefront/ogabassey/layout';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
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
  isCheckout,
}: {
  merchant: MerchantData;
  slug: string; // identifier used
  children: React.ReactNode;
  isCheckout: boolean;
}) {
  // Read theme cookie server-side for SSR consistency
  // CRITICAL: Always provide a theme value to avoid hydration mismatch
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('storefront-theme')?.value;
  const initialTheme: V2ThemeMode =
    themeCookie === 'standard' || themeCookie === 'santa'
      ? themeCookie
      : 'standard'; // Default to 'standard' for consistent SSR

  const templateId = (merchant as any).template_id;

  if (templateId === 'ogabassey') {
    return (
      <OgabasseyLayout
        merchant={merchant}
        initialTheme={initialTheme}
        isCheckout={isCheckout}
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

// Enable ISR - revalidate categories every 5 minutes
export const revalidate = 300;

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
  const routingMode = hasSubdomain || hasCustomDomain ? 'domain' : 'path';

  // Detect checkout page from pathname header (set by middleware)
  const pathname = headersList.get('x-pathname') || '';
  const isCheckout = pathname.endsWith('/checkout');

  // Fetch navigation categories server-side (cached)
  const navigationCategories = await getCachedNavigationCategories(merchant.id);

  return (
    <MerchantProvider
      slug={merchantSlug}
      initialMerchant={merchant as unknown as MerchantData}
      initialRoutingMode={routingMode}
      navigationCategories={navigationCategories}
    >
      <CartProvider enableSmartCartPro>
        <MerchantSlugSync slug={merchantSlug} />
        {/*
          Global Layout Wrapper logic:
          - Keeps layout persistent across route changes (seamless navigation)
          - Prevents header flashing/re-rendering
        */}
        <StorefrontLayoutRenderer
          merchant={merchant as unknown as MerchantData}
          slug={slug}
          isCheckout={isCheckout}
        >
          {children}
        </StorefrontLayoutRenderer>
      </CartProvider>
    </MerchantProvider>
  );
}
