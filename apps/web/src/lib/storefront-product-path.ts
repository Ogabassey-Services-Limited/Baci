import type { Route } from 'next';
import { serializeStorefrontProductPathSegment } from './storefront-product-path-serialization';

export type StorefrontProductUrlInput = {
  slug?: string;
  name: string;
  category?: string | null;
  categories?: { name?: string; slug?: string } | null;
  category_slug?: string | null;
  categorySlug?: string;
  canonical_url?: string | null;
  condition?: 'new' | 'used' | string;
  condition_detail?: string;
  id: string;
};

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

function normalizeCanonicalCategorySlug(
  slug: string | null | undefined
): string | null {
  const normalized = slug?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function generateProductSlug(
  name: string,
  _condition?: 'new' | 'used' | string,
  _conditionDetail?: string
): string {
  let cleanName = name;
  const lowerName = name.toLowerCase();

  if (lowerName.endsWith(' (new)')) cleanName = name.slice(0, -6);
  else if (lowerName.endsWith(' (used)')) cleanName = name.slice(0, -7);
  else if (lowerName.endsWith(' new')) cleanName = name.slice(0, -4);
  else if (lowerName.endsWith(' used')) cleanName = name.slice(0, -5);

  return generateSlug(cleanName);
}

function buildPath(categorySlug: string, productSlug: string): Route {
  return `/${serializeStorefrontProductPathSegment(categorySlug)}/${serializeStorefrontProductPathSegment(productSlug)}` as Route;
}

export function buildProductUrl(
  productSlug: string,
  category?: string | null | { name?: string; slug?: string },
  categorySlug?: string | null
): Route {
  if (typeof category === 'object' && category?.slug) {
    const normalizedCategorySlug = normalizeCanonicalCategorySlug(
      category.slug
    );
    if (normalizedCategorySlug)
      return buildPath(normalizedCategorySlug, productSlug);
  }

  const normalizedCategorySlug = normalizeCanonicalCategorySlug(categorySlug);
  if (normalizedCategorySlug)
    return buildPath(normalizedCategorySlug, productSlug);

  if (typeof category === 'string') {
    const slug = normalizeCanonicalCategorySlug(generateSlug(category));
    if (slug) return buildPath(slug, productSlug);
  }

  return buildPath('products', productSlug);
}

function extractCanonicalProductPath(
  canonicalUrl: string | null | undefined
): Route | null {
  const normalizedCanonical = canonicalUrl?.trim();
  if (!normalizedCanonical) return null;

  try {
    const parsed = new URL(normalizedCanonical, 'https://storefront.invalid');
    const canonicalSegments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (canonicalSegments.length === 0) return null;

    if (
      canonicalSegments.length >= 3 &&
      !STOREFRONT_ROOT_SEGMENTS.has(canonicalSegments[0].toLowerCase()) &&
      STOREFRONT_ROOT_SEGMENTS.has(canonicalSegments[1].toLowerCase())
    ) {
      canonicalSegments.shift();
    }
    if (canonicalSegments.length !== 2) return null;

    const normalizedCategorySlug = normalizeCanonicalCategorySlug(
      canonicalSegments[0]
    );
    const [, productSlug] = canonicalSegments;
    if (!productSlug || productSlug.includes('.')) return null;

    const rootSegment = normalizedCategorySlug ?? canonicalSegments[0];
    if (
      rootSegment.includes('.') ||
      NON_PRODUCT_CANONICAL_ROUTE_SEGMENTS.has(rootSegment)
    ) {
      return null;
    }

    return buildPath(rootSegment, productSlug);
  } catch {
    return null;
  }
}

export function getProductUrl(product: StorefrontProductUrlInput): Route {
  const canonicalPath = extractCanonicalProductPath(product.canonical_url);
  if (canonicalPath) return canonicalPath;

  const productSlug =
    product.slug ||
    generateProductSlug(
      product.name,
      product.condition,
      product.condition_detail
    ) ||
    product.id;
  const categorySlug =
    product.categories?.slug || product.category_slug || product.categorySlug;

  return buildProductUrl(
    productSlug,
    product.categories?.name || product.category,
    categorySlug
  );
}
