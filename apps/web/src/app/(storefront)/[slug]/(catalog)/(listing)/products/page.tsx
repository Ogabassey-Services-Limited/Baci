import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { CatalogListingLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { getCachedStorefrontProductIndex } from '@/lib/cached-storefront-product-index';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { STOREFRONT_PRODUCTS_PER_PAGE } from '@/lib/storefront-pagination';
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;

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
    page: 1,
    limit: STOREFRONT_PRODUCTS_PER_PAGE,
  });

  const baseUrl = buildStoreUrl(merchant);
  const productsUrl = `${baseUrl}/products`;
  const title = `Products | ${merchant.business_name}`;
  const description = generateMetaDescription(
    merchant.site_description || '',
    160,
    {
      minLength: 110,
      fallback: `Browse all products available at ${merchant.business_name}. Compare smartphones, laptops, accessories, and gaming devices with nationwide delivery and flexible payment options.`,
    }
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
    <>
      <Suspense fallback={<CatalogListingLoading />}>
        <ProductsPageContent {...props} />
      </Suspense>
      <StorefrontDynamicMetadataMarker />
    </>
  );
}
