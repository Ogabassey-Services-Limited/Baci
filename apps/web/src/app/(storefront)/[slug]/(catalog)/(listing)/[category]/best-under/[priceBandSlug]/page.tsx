import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ProductDetailRouteLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { getIndexableRobotsMetadata } from '@/lib/seo-utils';
import { loadPriceBandPage } from '@/lib/storefront-compare/load-price-band-page';
import { PriceBandPageContent } from './price-band-page-content';

interface PriceBandPageRouteProps {
  params: Promise<{
    slug: string;
    category: string;
    priceBandSlug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PriceBandPageRouteProps): Promise<Metadata> {
  const resolvedParams = await params;
  const page = await loadPriceBandPage({
    merchantSlug: resolvedParams.slug,
    categorySlug: resolvedParams.category,
    priceBandSlug: resolvedParams.priceBandSlug,
  });

  if (!page?.isIndexable) {
    notFound();
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
    robots: getIndexableRobotsMetadata(),
  };
}

async function PriceBandPageRuntime(props: PriceBandPageRouteProps) {
  // Keep tenant/domain price-band work request-bound while the route prerenders
  // a Suspense fallback shell. Cache Components rejects route-level dynamic flags.
  await connection();

  return <PriceBandPageContent {...props} />;
}

export default function PriceBandPage(props: PriceBandPageRouteProps) {
  return (
    <Suspense fallback={<ProductDetailRouteLoading />}>
      <PriceBandPageRuntime {...props} />
    </Suspense>
  );
}
