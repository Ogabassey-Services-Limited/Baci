import type { RefinementCtx } from 'zod';

interface SeoEntry {
  indexable: boolean;
  path: string;
}

interface SeoProduct {
  canonicalPath?: string | null;
  categoryIds?: readonly string[];
  primaryCategoryId?: string | null;
  slug: string;
}

interface SeoCategory {
  id: string;
}

const LEGACY_POLICY_REDIRECT_PATHS = new Set([
  '/privacy-policy',
  '/terms-and-conditions',
  '/terms-of-service',
]);

function addIssue(
  context: RefinementCtx,
  index: number,
  message: string
): void {
  context.addIssue({
    code: 'custom',
    message,
    path: ['seoEntries', index, 'indexable'],
  });
}

/** Applies route-specific indexability guards after a path resolves. */
export function validatePublicProjectionSeoEntryGuards({
  categoriesBySlug,
  categoryHasProducts,
  entry,
  index,
  products,
  context,
}: {
  categoriesBySlug: ReadonlyMap<string, SeoCategory>;
  categoryHasProducts: ReadonlyMap<string, boolean>;
  context: RefinementCtx;
  entry: SeoEntry;
  index: number;
  products: readonly SeoProduct[];
}): void {
  if (entry.path === '/cart' && entry.indexable)
    addIssue(context, index, 'Private cart routes must not be indexable');
  if (LEGACY_POLICY_REDIRECT_PATHS.has(entry.path) && entry.indexable)
    addIssue(
      context,
      index,
      'Legacy policy redirect routes must not be indexable'
    );
  const categorySlug = entry.path.startsWith('/') ? entry.path.slice(1) : null;
  const category = categorySlug
    ? categoriesBySlug.get(categorySlug)
    : undefined;
  if (category && entry.indexable && !categoryHasProducts.get(category.id))
    addIssue(context, index, 'Empty category routes must not be indexable');
  const productAlias = entry.path.startsWith('/products/')
    ? products.find((product) => `/products/${product.slug}` === entry.path)
    : undefined;
  if (
    productAlias?.canonicalPath &&
    !productAlias.canonicalPath.startsWith('/products/') &&
    entry.indexable
  )
    addIssue(
      context,
      index,
      'Legacy product alias routes must not be indexable'
    );
}
