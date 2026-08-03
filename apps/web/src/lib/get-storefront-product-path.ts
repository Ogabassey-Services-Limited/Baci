import type { Route } from 'next';
import { buildStorefrontProductPath } from './build-storefront-product-path';
import { generateStorefrontProductSlug } from './generate-storefront-product-slug';
import type { StorefrontProductUrlInput } from './storefront-product-url-input';

const STOREFRONT_ROOT_SEGMENTS = new Set([
  'products',
  'blog',
  'smartphones',
  'laptops',
  'macbooks',
  'gaming',
  'accessories',
  'audio',
  'tablets',
  'desktops',
  'monitors',
  'smartwatches',
  'gaming-laptops',
  'gift-cards',
  'gaming-accessories',
  'earbuds',
  'headphones',
  'wearables',
  'printers',
  'repair',
  'repairs',
  'swap',
  'wallet',
  'account',
  'wishlist',
  'faq',
  'about',
  'terms',
  'privacy',
]);

const NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS = new Set([
  'about',
  'account',
  'api',
  'blog',
  'faq',
  'favicon',
  'icon',
  'manifest',
  'opengraph-image',
  'privacy',
  'repair',
  'repairs',
  'robots',
  'rss',
  'sitemap',
  'sitemaps',
  'swap',
  'terms',
  'twitter-image',
  'wallet',
  'wishlist',
]);

function extractCanonicalProductPath(
  canonicalUrl: string | null | undefined
): Route | null {
  const normalizedCanonical = canonicalUrl?.trim();
  if (!normalizedCanonical) return null;

  try {
    const parsed = new URL(normalizedCanonical, 'https://storefront.invalid');
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (
      segments.length >= 3 &&
      !STOREFRONT_ROOT_SEGMENTS.has(segments[0].toLowerCase()) &&
      STOREFRONT_ROOT_SEGMENTS.has(segments[1].toLowerCase())
    )
      segments.shift();
    if (segments.length !== 2) return null;

    const [categorySlug, productSlug] = segments;
    if (
      !productSlug ||
      categorySlug.includes('.') ||
      productSlug.includes('.') ||
      NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS.has(categorySlug.toLowerCase())
    )
      return null;

    return buildStorefrontProductPath(productSlug, null, categorySlug);
  } catch {
    return null;
  }
}

export function getStorefrontProductPath(
  product: StorefrontProductUrlInput
): Route {
  const canonicalPath = extractCanonicalProductPath(product.canonical_url);
  if (canonicalPath) return canonicalPath;

  const productSlug =
    product.slug || generateStorefrontProductSlug(product.name) || product.id;
  const categorySlug =
    product.categories?.slug || product.category_slug || product.categorySlug;

  return buildStorefrontProductPath(
    productSlug,
    product.categories?.name || product.category,
    categorySlug
  );
}
