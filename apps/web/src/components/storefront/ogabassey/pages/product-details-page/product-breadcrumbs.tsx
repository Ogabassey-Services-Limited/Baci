import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { NormalizedProductDetails } from './product-details-helpers';

interface ProductBreadcrumbsProps {
  basePath: string;
  homeHref: string;
  productData: NormalizedProductDetails;
}

export function ProductBreadcrumbs({
  basePath,
  homeHref,
  productData,
}: ProductBreadcrumbsProps) {
  const categorySlug =
    productData.categories?.slug ||
    productData.categorySlug ||
    encodeURIComponent(
      (productData.categories?.name || productData.category || '').toLowerCase()
    );
  const categoryHref = asRoute(
    `${basePath}/${categorySlug}`.replace(/\/{2,}/g, '/')
  );

  return (
    <nav className="mb-8 flex items-center overflow-x-auto whitespace-nowrap pb-2 text-sm text-gray-500">
      <Link
        href={homeHref}
        className="transition-colors md:hover:text-red-600"
      >
        Home
      </Link>
      <ChevronRight size={16} className="mx-2" />
      <Link
        href={categoryHref}
        className="transition-colors md:hover:text-red-600"
      >
        {productData.categories?.name || productData.category}
      </Link>
      <ChevronRight size={16} className="mx-2" />
      <span className="font-medium text-gray-900">{productData.name}</span>
    </nav>
  );
}
