import type { Route } from 'next';

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
  const categorySlug = item.categories?.slug || item.category_slug?.trim();

  if (categorySlug) {
    return `${normalizedBasePath}/${categorySlug}/${productSlug}` as Route;
  }

  return `${normalizedBasePath}/products/${productSlug}` as Route;
}
