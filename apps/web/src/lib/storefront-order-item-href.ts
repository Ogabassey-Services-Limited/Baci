import type { Route } from 'next';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';

interface StorefrontOrderItemHrefInput {
  product_slug?: string | null;
  category_slug?: string | null;
  categories?: { name?: string; slug?: string } | null;
}

export function getStorefrontOrderItemHref(
  item: StorefrontOrderItemHrefInput,
  basePath = ''
): Route | null {
  const productSlug = item.product_slug?.trim();
  if (!productSlug) {
    return null;
  }

  const normalizedBasePath = basePath === '/' ? '' : basePath;
  const categorySlug = normalizeStorefrontCategorySlug(
    item.categories?.slug || item.category_slug
  );

  if (categorySlug) {
    return `${normalizedBasePath}/${categorySlug}/${productSlug}` as Route;
  }

  return `${normalizedBasePath}/products/${productSlug}` as Route;
}
