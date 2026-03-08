import type { Route } from 'next';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { NormalizedProductDetails } from './product-details-helpers';

interface ProductBreadcrumbsProps {
  basePath: string;
  homeHref: Route;
  productData: NormalizedProductDetails;
}

export function ProductBreadcrumbs({
  basePath,
  homeHref,
  productData,
}: ProductBreadcrumbsProps) {
  const categoryLabel =
    productData.categories?.name || productData.category || 'Category';
  const categorySlug =
    productData.categories?.slug ||
    productData.categorySlug ||
    encodeURIComponent(categoryLabel.toLowerCase());
  const categoryHref = asRoute(
    `${basePath}/${categorySlug}`.replace(/\/{2,}/g, '/')
  );
  const productHref = asRoute(
    `${basePath}/${categorySlug}/${productData.slug || ''}`.replace(
      /\/{2,}/g,
      '/'
    )
  );
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: homeHref,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryLabel,
        item: categoryHref,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: productData.name,
        item: productData.slug ? productHref : categoryHref,
      },
    ],
  };
  const breadcrumbSchemaJson = JSON.stringify(breadcrumbSchema).replace(
    /</g,
    '\\u003c'
  );

  return (
    <>
      <script type="application/ld+json">{breadcrumbSchemaJson}</script>
      <nav className="mb-8 flex items-center overflow-x-auto whitespace-nowrap pb-2 text-sm text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_70%,transparent)]">
        <Link
          href={homeHref}
          className="transition-colors md:hover:text-[var(--store-primary)]"
        >
          Home
        </Link>
        <ChevronRight size={16} className="mx-2" />
        <Link
          href={categoryHref}
          className="transition-colors md:hover:text-[var(--store-primary)]"
        >
          {categoryLabel}
        </Link>
        <ChevronRight size={16} className="mx-2" />
        <span className="font-medium text-[var(--store-background-text,#111827)]">
          {productData.name}
        </span>
      </nav>
    </>
  );
}
