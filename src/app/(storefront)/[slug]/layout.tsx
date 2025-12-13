import { notFound } from 'next/navigation';
import type React from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { getCachedMerchant } from '@/lib/cached-data';

// Valid slug pattern: alphanumeric and hyphens, no file extensions
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

// Reserved paths that should NOT be treated as merchant slugs
const RESERVED_PATHS = new Set([
  'cart',
  'checkout',
  'api',
  'auth',
  'login',
  'logout',
  'dashboard',
  'admin',
  'builder',
  'onboarding',
  'preview',
  'about',
  'contact',
  'blog',
  'pricing',
  'terms',
  'privacy',
  'features',
  'demo',
  'developers',
  'track',
  'invite',
  'reset-password',
  'template-preview',
  'orders',
  'saved',
  'addresses',
  'reviews',
  'help',
  'wallet',
  'repairs',
  'swap',
]);

function isValidMerchantSlug(slug: string): boolean {
  return (
    typeof slug === 'string' &&
    !!slug.trim() &&
    !slug.includes('.') && // No file extensions
    !RESERVED_PATHS.has(slug.toLowerCase()) && // Not a reserved path
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate slug format to prevent database queries for static assets
  if (!isValidMerchantSlug(slug)) {
    notFound();
  }

  // Use cached merchant data for better performance
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if store is published - show "coming soon" page if not
  // In development, allow viewing unpublished stores for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  return (
    <MerchantProvider
      slug={slug}
      initialMerchant={merchant as unknown as MerchantData}
    >
      <CartProvider enableSmartCartPro>
        <MerchantSlugSync slug={slug} />
        {children}
      </CartProvider>
    </MerchantProvider>
  );
}
