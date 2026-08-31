import type { RefinementCtx } from 'zod';
import { addPublicProjectionSeoPolicyPaths } from './add-public-projection-seo-policy-paths';
import {
  getPublicProjectionBlogSeoPaths,
  isPublicProjectionBlogPost,
} from './get-public-projection-blog-seo-paths';
import { hasEligiblePublicProjectionCategoryCompareHub } from './has-eligible-public-projection-category-compare-hub';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';
import { validatePublicProjectionSeoEntryGuards } from './validate-public-projection-seo-entry-guards';

interface SeoEntry {
  indexable: boolean;
  path: string;
}

interface SeoProduct {
  available: boolean;
  canonicalPath?: string | null;
  categoryIds?: readonly string[];
  createdAt?: string;
  id: string;
  name: string;
  brand?: string | null;
  priceMinor: number;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  primaryCategoryId?: string | null;
  slug: string;
  updatedAt?: string;
}

interface SeoCategory {
  id: string;
  parentId?: string | null;
  slug: string;
}

interface SeoBlogPost {
  authorName: string;
  category?: string | null;
  slug: string;
  title: string;
}

interface SeoContentPage {
  slug: string;
}

interface SeoPayload {
  blogPosts?: readonly SeoBlogPost[];
  categories?: readonly SeoCategory[];
  contentPages?: readonly SeoContentPage[];
  featureFlags?: readonly { enabled: boolean; key: string }[];
  merchant: { currency: string; hostname: string; slug: string };
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
  maintainedComparePaths?: readonly string[];
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
  '/pages/rewards',
  '/blog',
]);
const COMPARE_HUB_CATEGORY_SCAN_LIMIT = 80;
const COMPARE_HUB_PRODUCTS_PER_CATEGORY_LIMIT = 80;

function hasEnabledFeature(
  featureFlags: SeoPayload['featureFlags'],
  key: string
) {
  return (
    featureFlags?.some((flag) => flag.key === key && flag.enabled) ?? false
  );
}

function addIssue(context: RefinementCtx, index: number) {
  context.addIssue({
    code: 'custom',
    message: 'SEO entry path does not resolve to a released storefront route',
    path: ['seoEntries', index, 'path'],
  });
}

function haveDifferentComparableSpecs(left: SeoProduct, right: SeoProduct) {
  const leftSpecs = left.productKeySpecs ?? {};
  const rightSpecs = right.productKeySpecs ?? {};
  const sharedKeys = Object.keys(leftSpecs).filter((key) => key in rightSpecs);
  return sharedKeys.filter((key) => {
    const leftValue = leftSpecs[key];
    const rightValue = rightSpecs[key];
    if (Array.isArray(leftValue) && Array.isArray(rightValue))
      return (
        JSON.stringify([...leftValue].map(String).sort()) !==
        JSON.stringify([...rightValue].map(String).sort())
      );
    return leftValue !== rightValue;
  }).length;
}

function hasEligibleCompareHub(
  categories: readonly SeoCategory[],
  products: readonly SeoProduct[]
) {
  for (const category of categories.slice(0, COMPARE_HUB_CATEGORY_SCAN_LIMIT)) {
    const categoryProducts = products
      .filter((product) =>
        [
          ...(product.categoryIds ?? []),
          ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
        ].includes(category.id)
      )
      .slice(0, COMPARE_HUB_PRODUCTS_PER_CATEGORY_LIMIT);
    for (let leftIndex = 0; leftIndex < categoryProducts.length; leftIndex += 1)
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < categoryProducts.length;
        rightIndex += 1
      )
        if (
          haveDifferentComparableSpecs(
            categoryProducts[leftIndex],
            categoryProducts[rightIndex]
          ) >= 3
        )
          return true;
  }
  return false;
}

/** Rejects SEO metadata paths that cannot be served by this public release. */
export function validatePublicProjectionSeoEntries(
  payload: SeoPayload,
  context: RefinementCtx
) {
  const knownPaths = new Set(STATIC_SEO_PATHS);
  addPublicProjectionSeoPolicyPaths(knownPaths, payload.policies);
  if (payload.policies?.warrantyPolicy?.summary.trim())
    knownPaths.add('/warranty');
  for (const page of payload.contentPages ?? [])
    knownPaths.add(
      page.slug === 'rewards' ? '/pages/rewards' : `/${page.slug}`
    );
  for (const category of payload.categories ?? []) {
    knownPaths.add(`/${category.slug}`);
    knownPaths.add(`/${category.slug}/compare`);
  }
  const categoryHasProducts = new Map(
    (payload.categories ?? []).map((category) => [
      category.id,
      payload.products.some((product) =>
        [
          ...(product.categoryIds ?? []),
          ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
        ].includes(category.id)
      ),
    ])
  );
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
  for (const post of payload.blogPosts ?? [])
    if (isPublicProjectionBlogPost(post)) knownPaths.add(`/blog/${post.slug}`);
  const maintainedComparePaths = new Set(payload.maintainedComparePaths ?? []);
  for (const path of getPublicProjectionBlogSeoPaths(
    payload.blogPosts ?? [],
    payload.merchant
  ))
    knownPaths.add(path);
  const compareHubEligible = hasEligibleCompareHub(
    payload.categories ?? [],
    payload.products
  );
  for (const [index, entry] of (payload.seoEntries ?? []).entries()) {
    if (
      !knownPaths.has(entry.path) &&
      !hasEligibleCommercialSupportPath(
        entry.path,
        categoriesBySlug,
        payload.products,
        {
          currency: payload.merchant.currency,
          maintainedComparePaths,
        }
      )
    ) {
      addIssue(context, index);
      continue;
    }
    validatePublicProjectionSeoEntryGuards({
      categoriesBySlug,
      categoryHasProducts,
      context,
      entry,
      index,
      products: payload.products,
    });
    if (entry.path === '/pages/rewards' && entry.indexable)
      context.addIssue({
        code: 'custom',
        message: 'Private rewards routes must not be indexable',
        path: ['seoEntries', index, 'indexable'],
      });
    if (
      entry.path === '/blog' &&
      entry.indexable &&
      !hasEnabledFeature(payload.featureFlags, 'blog_enabled')
    )
      context.addIssue({
        code: 'custom',
        message: 'Blog SEO requires the blog feature to be enabled',
        path: ['seoEntries', index, 'indexable'],
      });
    if (entry.path === '/compare' && entry.indexable && !compareHubEligible)
      context.addIssue({
        code: 'custom',
        message: 'Compare SEO requires an eligible projected comparison pair',
        path: ['seoEntries', index, 'indexable'],
      });
    const categoryCompareMatch = /^\/([^/]+)\/compare$/u.exec(entry.path);
    if (
      categoryCompareMatch?.[1] &&
      entry.indexable &&
      !hasEligiblePublicProjectionCategoryCompareHub(
        categoryCompareMatch[1],
        categoriesBySlug,
        payload.products,
        maintainedComparePaths,
        payload.merchant.currency
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Category compare SEO requires an eligible projected comparison link',
        path: ['seoEntries', index, 'indexable'],
      });
  }
}
