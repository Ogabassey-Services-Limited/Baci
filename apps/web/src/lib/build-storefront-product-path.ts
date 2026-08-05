import type { Route } from 'next';
import { generateStorefrontSlug } from './generate-storefront-slug';
import { serializeStorefrontProductPathSegment } from './serialize-storefront-product-path-segment';

type ProductCategory = string | null | { name?: string; slug?: string };

function normalizeCategorySlug(slug: string | null | undefined): string | null {
  const normalized = serializeStorefrontProductPathSegment(
    slug ?? ''
  ).toLowerCase();
  return normalized || null;
}

function buildPath(categorySlug: string, productSlug: string): Route {
  return `/${serializeStorefrontProductPathSegment(categorySlug)}/${serializeStorefrontProductPathSegment(productSlug)}` as Route;
}

export function buildStorefrontProductPath(
  productSlug: string,
  category?: ProductCategory,
  categorySlug?: string | null
): Route {
  if (typeof category === 'object' && category?.slug) {
    const normalizedCategorySlug = normalizeCategorySlug(category.slug);
    if (normalizedCategorySlug)
      return buildPath(normalizedCategorySlug, productSlug);
  }

  const normalizedCategorySlug = normalizeCategorySlug(categorySlug);
  if (normalizedCategorySlug)
    return buildPath(normalizedCategorySlug, productSlug);

  if (typeof category === 'string') {
    const derivedCategorySlug = normalizeCategorySlug(
      generateStorefrontSlug(category)
    );
    if (derivedCategorySlug) return buildPath(derivedCategorySlug, productSlug);
  }

  return buildPath('products', productSlug);
}
