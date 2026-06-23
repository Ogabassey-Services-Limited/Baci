import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import {
  getCachedLegacyProductRedirectTarget,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { getProductUrl } from '@/lib/seo-utils';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import { StorefrontRouteNotFoundContent } from '../../../../storefront-route-not-found-content';
import { buildProductRedirectPath } from '../../products/[productSlug]/build-product-redirect-path';

// Intentional page-level metadata for this redirect-only legacy route: keep it noindex so crawlers do not treat the transitional URL as canonical.
export const metadata: Metadata = {
  title: 'Product Redirect',
  description:
    'Redirects legacy product URLs to the canonical storefront product page.',
  // Replace root metadata alternates so noindex fallback pages do not inherit a canonical.
  alternates: null,
  robots: { index: false, follow: true },
};

interface PageProps {
  params: Promise<{
    slug: string;
    productSlug: string;
  }>;
}

async function resolveLegacyProductPath(
  slug: string,
  productSlug: string
): Promise<string | null> {
  if (!isValidMerchantIdentifier(slug)) {
    return null;
  }

  const merchant = await getMerchantByIdentifier(slug);
  if (!merchant) {
    return null;
  }

  const normalizedSlug = productSlug.toLowerCase();
  const normalizeProductForUrl = <
    T extends {
      categories?:
        | { name?: string; slug?: string }[]
        | { name?: string; slug?: string }
        | null;
    },
  >(
    product: T
  ) => ({
    ...product,
    categories: Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories,
  });
  const directProduct =
    (await getCachedProductWithDetails(merchant.id, productSlug)) ||
    (productSlug !== normalizedSlug
      ? await getCachedProductWithDetails(merchant.id, normalizedSlug)
      : null);

  if (directProduct) {
    return getProductUrl(normalizeProductForUrl(directProduct));
  }

  const legacyRedirectTarget = await getCachedLegacyProductRedirectTarget(
    merchant.id,
    productSlug
  );
  if (legacyRedirectTarget) {
    return getProductUrl(normalizeProductForUrl(legacyRedirectTarget));
  }

  return null;
}

export default async function LegacyProductPage({ params }: PageProps) {
  await connection();
  const { slug, productSlug } = await params;
  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const redirectPath = await resolveLegacyProductPath(slug, productSlug);

  if (!redirectPath) {
    const merchant = await getMerchantByIdentifier(slug);

    if (!merchant) {
      notFound();
    }

    // Metadata keeps this legacy route noindex; this stable body only handles
    // missing products for valid storefronts without throwing inside the
    // streamed page render.
    return (
      <StorefrontRouteNotFoundContent
        backHref={isDomainIdentifier(slug) ? '/' : `/${slug}`}
        message="This product is unavailable or has moved."
        title="Product not found"
      />
    );
  }

  permanentRedirect(buildProductRedirectPath(slug, redirectPath));
}
