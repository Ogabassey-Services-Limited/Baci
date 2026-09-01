import type { RefinementCtx } from 'zod';
import { addPublicProjectionSeoPolicyPaths } from './add-public-projection-seo-policy-paths';
import { buildPublicProjectionCategoryScopes } from './build-public-projection-category-scopes';
import {
  getPublicProjectionBlogSeoPaths,
  isPublicProjectionBlogPost,
} from './get-public-projection-blog-seo-paths';
import { hasEligiblePublicProjectionCategoryCompareHub } from './has-eligible-public-projection-category-compare-hub';
import { hasEligiblePublicProjectionCompareHub } from './has-eligible-public-projection-compare-hub';
import { validatePublicProjectionInventoryTimestamps } from './validate-public-projection-inventory-timestamps';
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
  status?: string;
}

interface SeoBlogPost {
  authorName: string;
  category?: string | null;
  slug: string;
  title: string;
}

interface SeoContentPage {
  body?: string;
  slug: string;
}

interface SeoPayload {
  blogPosts?: readonly SeoBlogPost[];
  categories?: readonly SeoCategory[];
  contentPages?: readonly SeoContentPage[];
  featureFlags?: readonly { enabled: boolean; key: string }[];
  merchant: {
    currency: string;
    hostname: string;
    slug: string;
    template?: { id: string };
  };
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

const CONTENT_BACKED_POLICY_SLUGS = new Set([
  'privacy',
  'privacy-policy',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
]);

function hasTemplatePolicyPage(templateId: string | undefined): boolean {
  return Boolean(
    templateId && templateId !== 'default' && templateId !== 'puck'
  );
}

/** Rejects SEO metadata paths that cannot be served by this public release. */
export function validatePublicProjectionSeoEntries(
  payload: SeoPayload,
  context: RefinementCtx
) {
  validatePublicProjectionInventoryTimestamps(
    payload.categories ?? [],
    payload.products,
    context
  );
  const knownPaths = new Set(STATIC_SEO_PATHS);
  addPublicProjectionSeoPolicyPaths(knownPaths, payload.policies);
  if (payload.policies?.warrantyPolicy?.summary.trim())
    knownPaths.add('/warranty');
  for (const page of payload.contentPages ?? []) {
    // The live warranty route is policy-backed; contentPages cannot create it.
    if (
      page.slug === 'warranty' &&
      !payload.policies?.warrantyPolicy?.summary.trim()
    )
      continue;
    if (
      CONTENT_BACKED_POLICY_SLUGS.has(page.slug) &&
      !page.body?.trim() &&
      !hasTemplatePolicyPage(payload.merchant.template?.id)
    )
      continue;
    knownPaths.add(
      page.slug === 'rewards' ? '/pages/rewards' : `/${page.slug}`
    );
  }
  for (const category of payload.categories ?? []) {
    knownPaths.add(`/${category.slug}`);
    knownPaths.add(`/${category.slug}/compare`);
  }
  const categoryScopes = buildPublicProjectionCategoryScopes(
    payload.categories ?? [],
    payload.products
  );
  const categoryHasProducts = new Map(
    [...categoryScopes].map(([categoryId, scope]) => [
      categoryId,
      scope.hasProducts,
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
  const compareHubEligible = hasEligiblePublicProjectionCompareHub(
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
