import type { RefinementCtx } from 'zod';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

interface SeoEntry {
  indexable: boolean;
  path: string;
}

interface SeoProduct {
  available: boolean;
  canonicalPath?: string | null;
  categoryIds?: readonly string[];
  id: string;
  name: string;
  brand?: string | null;
  primaryCategoryId?: string | null;
  slug: string;
}

interface SeoCategory {
  id: string;
  slug: string;
}

interface SeoBlogPost {
  authorName: string;
  category?: string | null;
  slug: string;
}

interface SeoContentPage {
  slug: string;
}

interface SeoPayload {
  blogPosts?: readonly SeoBlogPost[];
  categories?: readonly SeoCategory[];
  contentPages?: readonly SeoContentPage[];
  policies?: {
    privacy?: string;
    returns?: string;
    shipping?: string;
    terms?: string;
    returnPolicy?: { localRoute: '/returns'; summary?: string };
    shippingPolicy?: { localRoute: '/shipping'; summary?: string };
    warrantyPolicy?: { summary: string };
  };
  products: readonly SeoProduct[];
  seoEntries?: readonly SeoEntry[];
}

const STATIC_SEO_PATHS = new Set([
  '/',
  '/about',
  '/cart',
  '/compare',
  '/contact',
  '/faq',
  '/products',
  '/rewards',
  '/blog',
]);

function toRouteSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function addIssue(context: RefinementCtx, index: number) {
  context.addIssue({
    code: 'custom',
    message: 'SEO entry path does not resolve to a released storefront route',
    path: ['seoEntries', index, 'path'],
  });
}

function addPolicyPaths(
  knownPaths: Set<string>,
  policies: SeoPayload['policies']
) {
  if (policies?.privacy?.trim()) {
    knownPaths.add('/privacy');
    knownPaths.add('/privacy-policy');
  }
  if (policies?.terms?.trim()) {
    knownPaths.add('/terms');
    knownPaths.add('/terms-and-conditions');
    knownPaths.add('/terms-of-service');
  }
  if (policies?.returns?.trim() || policies?.returnPolicy)
    knownPaths.add('/returns');
  if (policies?.shipping?.trim() || policies?.shippingPolicy)
    knownPaths.add('/shipping');
}

/** Rejects SEO metadata paths that cannot be served by this public release. */
export function validatePublicProjectionSeoEntries(
  payload: SeoPayload,
  context: RefinementCtx
) {
  const knownPaths = new Set(STATIC_SEO_PATHS);
  addPolicyPaths(knownPaths, payload.policies);
  if (payload.policies?.warrantyPolicy?.summary.trim())
    knownPaths.add('/warranty');
  for (const page of payload.contentPages ?? [])
    knownPaths.add(`/${page.slug}`);
  for (const category of payload.categories ?? [])
    knownPaths.add(`/${category.slug}`);
  const categoriesById = new Map(
    (payload.categories ?? []).map((category) => [category.id, category.slug])
  );
  const categoriesBySlug = new Map(
    (payload.categories ?? []).map((category) => [category.slug, category])
  );
  for (const [productIndex, product] of payload.products.entries()) {
    knownPaths.add(`/products/${product.slug}`);
    const referencedCategoryIds = new Set([
      ...(product.categoryIds ?? []),
      ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
    ]);
    if (product.canonicalPath) {
      const [categorySlug] = product.canonicalPath.split('/').filter(Boolean);
      if (
        categorySlug &&
        categorySlug !== 'products' &&
        ![...categoriesById.entries()].some(
          ([categoryId, slug]) =>
            slug === categorySlug && referencedCategoryIds.has(categoryId)
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'Product canonical path must reference its category',
          path: ['products', productIndex, 'canonicalPath'],
        });
      knownPaths.add(product.canonicalPath);
    }
    for (const categoryId of [
      ...(product.categoryIds ?? []),
      ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
    ]) {
      const categorySlug = categoriesById.get(categoryId);
      if (categorySlug) knownPaths.add(`/${categorySlug}/${product.slug}`);
    }
  }
  for (const post of payload.blogPosts ?? []) {
    knownPaths.add(`/blog/${post.slug}`);
    const categorySlug = post.category ? toRouteSlug(post.category) : '';
    if (categorySlug) knownPaths.add(`/blog/category/${categorySlug}`);
    const authorSlug = toRouteSlug(post.authorName);
    if (authorSlug) knownPaths.add(`/blog/author/${authorSlug}`);
  }
  for (const [index, entry] of (payload.seoEntries ?? []).entries()) {
    if (
      !knownPaths.has(entry.path) &&
      !hasEligibleCommercialSupportPath(
        entry.path,
        categoriesBySlug,
        payload.products
      )
    ) {
      addIssue(context, index);
      continue;
    }
    if (entry.path === '/cart' && entry.indexable)
      context.addIssue({
        code: 'custom',
        message: 'Private cart routes must not be indexable',
        path: ['seoEntries', index, 'indexable'],
      });
  }
}
