import { notFound } from 'next/navigation';
import { connection } from 'next/server';
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

async function renderBrandAuthorityPage(props: BrandAuthorityPageRouteProps) {
  await connection();
  const { page, resolvedParams } = await loadIndexableBrandAuthorityPage(props);
  const pathPrefix = await brandAuthorityPageLoader.getStorefrontPathPrefix(
    resolvedParams.slug,
    page.merchant.slug
  );

  return <BrandAuthorityPageContent page={{ ...page, pathPrefix }} />;
}

export const brandAuthorityPageRuntime = {
  loadIndexablePage: loadIndexableBrandAuthorityPage,
  render: renderBrandAuthorityPage,
};
