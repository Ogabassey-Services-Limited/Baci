import { notFound } from 'next/navigation';
import type React from 'react';
import { MerchantSlugSync } from '@/components/storefront/merchant-slug-sync';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { CartProvider } from '@/hooks/use-cart';
import { type MerchantData, MerchantProvider } from '@/hooks/use-merchant';
import { getCachedMerchant, getCachedMerchantByDomain } from '@/lib/cached-data';

// Valid slug pattern: alphanumeric and hyphens, no file extensions
const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

// Valid domain pattern: basic domain format (e.g., ogabassey.com)
const VALID_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/;

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

/**
 * Check if the identifier looks like a domain (contains a dot)
 */
function isDomainIdentifier(identifier: string): boolean {
  return identifier.includes('.') && VALID_DOMAIN_REGEX.test(identifier.toLowerCase());
}

function isValidMerchantSlug(slug: string): boolean {
  return (
    typeof slug === 'string' &&
    !!slug.trim() &&
    !slug.includes('.') && // No file extensions
    !RESERVED_PATHS.has(slug.toLowerCase()) && // Not a reserved path
    VALID_SLUG_REGEX.test(slug.toLowerCase())
  );
}

/**
 * Validate that the identifier is either a valid slug or a valid domain
 */
function isValidMerchantIdentifier(identifier: string): boolean {
  return isValidMerchantSlug(identifier) || isDomainIdentifier(identifier);
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
  let merchant;
  if (isDomainIdentifier(slug)) {
    // Custom domain access (e.g., ogabassey.com)
    merchant = await getCachedMerchantByDomain(slug);
  } else {
    // Standard slug access (e.g., ogabassey)
    merchant = await getCachedMerchant(slug);
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

  return (
    <MerchantProvider
      slug={merchantSlug}
      initialMerchant={merchant as unknown as MerchantData}
    >
      <CartProvider enableSmartCartPro>
        <MerchantSlugSync slug={merchantSlug} />
        {children}
      </CartProvider>
    </MerchantProvider>
  );
}
