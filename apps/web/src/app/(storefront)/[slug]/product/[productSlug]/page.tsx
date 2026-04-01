import { notFound, permanentRedirect } from 'next/navigation';
import {
  getCachedLegacyProductRedirectTarget,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { getProductUrl } from '@/lib/seo-utils';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { buildProductRedirectPath } from '../../products/[productSlug]/build-product-redirect-path';

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
  const { slug, productSlug } = await params;
  const redirectPath = await resolveLegacyProductPath(slug, productSlug);

  if (!redirectPath) {
    notFound();
  }

  permanentRedirect(buildProductRedirectPath(slug, redirectPath));
}
