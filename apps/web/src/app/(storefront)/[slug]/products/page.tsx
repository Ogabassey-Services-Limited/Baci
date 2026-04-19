import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import {
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';
import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from '@/lib/storefront-social-images';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { ProductsPageContent } from './products-page-content';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

function ProductsPageFallback() {
  return (
    <div className="min-h-screen bg-[color:color-mix(in_srgb,var(--store-background,#ffffff)_94%,var(--store-background-text,#111827)_6%)] pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-sm text-[var(--store-muted-text,#6b7280)]">
          Loading products...
        </div>
        <ProductGridSkeleton count={8} columns={4} />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const currentPage = parseStorefrontPageParam(resolvedSearchParams.page);

  if (!currentPage) {
    notFound();
  }

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return {
      title: 'Store Not Found',
    };
  }

  const productIndex = await getCachedStorefrontProductIndex(merchant.id, {
    page: currentPage,
    limit: STOREFRONT_PRODUCTS_PER_PAGE,
  });
  const totalPages = Math.max(1, productIndex.totalPages || 1);

  if (!productIndex.hasError && currentPage > totalPages) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const productsUrl =
    currentPage > 1
      ? `${baseUrl}/products?page=${currentPage}`
      : `${baseUrl}/products`;
  const title =
    currentPage > 1
      ? `Products - Page ${currentPage} | ${merchant.business_name}`
      : `Products | ${merchant.business_name}`;
  const description = generateMetaDescription(
    merchant.site_description ||
      `Browse all products available at ${merchant.business_name}.`
  );
  const socialImageCandidates = [
    productIndex.products[0]?.image,
    productIndex.products[0]?.imageLarge,
    merchant.logo_url,
  ];

  return {
    title,
    description,
    alternates: {
      canonical: productsUrl,
    },
    robots: getIndexableRobotsMetadata(),
    openGraph: {
      title,
      description,
      url: productsUrl,
      type: 'website',
      siteName: merchant.business_name,
      images: getStorefrontOpenGraphImages(
        baseUrl,
        productIndex.products[0]?.name || `${merchant.business_name} products`,
        ...socialImageCandidates
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: getStorefrontTwitterImages(baseUrl, ...socialImageCandidates),
    },
  };
}

export default function ProductsPage(props: PageProps) {
  return (
    <Suspense fallback={<ProductsPageFallback />}>
      <ProductsPageContent {...props} />
    </Suspense>
  );
}
