import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CatalogListingLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { getIndexableRobotsMetadata } from '@/lib/seo-utils';
import { brandAuthorityPageLoader } from '@/lib/storefront-category/load-brand-authority-page';
import { BrandAuthorityPageContent } from './brand-authority-page-content';

interface BrandAuthorityPageRouteProps {
  params: Promise<{
    slug: string;
    category: string;
    brandSlug: string;
  }>;
}

async function loadIndexableBrandAuthorityPage(
  props: BrandAuthorityPageRouteProps
) {
  const resolvedParams = await props.params;
  const page = await brandAuthorityPageLoader.load(
    {
      merchantSlug: resolvedParams.slug,
      categorySlug: resolvedParams.category,
      brandSlug: resolvedParams.brandSlug,
    },
    { includeRequestPathPrefix: false }
  );

  if (!page) {
    notFound();
  }

  return { page, resolvedParams };
}

export async function generateMetadata(
  props: BrandAuthorityPageRouteProps
): Promise<Metadata> {
  const { page } = await loadIndexableBrandAuthorityPage(props);

  return {
    title: { absolute: page.metaTitle },
    description: page.metaDescription,
    alternates: { canonical: page.canonicalUrl },
    robots: getIndexableRobotsMetadata(),
  };
}

async function BrandAuthorityPageRuntime(props: BrandAuthorityPageRouteProps) {
  await connection();
  const { page, resolvedParams } = await loadIndexableBrandAuthorityPage(props);
  const pathPrefix = await brandAuthorityPageLoader.getStorefrontPathPrefix(
    resolvedParams.slug,
    page.merchant.slug
  );

  return <BrandAuthorityPageContent page={{ ...page, pathPrefix }} />;
}

export default function BrandAuthorityPage(
  props: BrandAuthorityPageRouteProps
) {
  return (
    <Suspense fallback={<CatalogListingLoading />}>
      <BrandAuthorityPageRuntime {...props} />
    </Suspense>
  );
}
