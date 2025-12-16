import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type React from 'react';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';

// Valid slug/domain patterns and reserved paths are now imported from @/lib/validation

import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

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

  // Determine routing mode based on headers (set by middleware)
  const headersList = await headers();
  const hasSubdomain = headersList.has('x-merchant-slug');
  const hasCustomDomain = headersList.has('x-custom-domain');
  const routingMode = hasSubdomain || hasCustomDomain ? 'domain' : 'path';

  return (
    <MerchantProvider
      slug={merchantSlug}
      initialMerchant={merchant as unknown as MerchantData}
      initialRoutingMode={routingMode}
    >
      <CartProvider enableSmartCartPro>
        <MerchantSlugSync slug={merchantSlug} />
        {children}
      </CartProvider>
    </MerchantProvider>
  );
}
