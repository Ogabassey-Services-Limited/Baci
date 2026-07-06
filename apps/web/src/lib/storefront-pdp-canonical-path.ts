import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';
import { getProductUrl } from '@/lib/seo-utils';

/**
 * Canonical PDP path composition shared by the internal product-canonical
 * route and the proxy middleware's direct-RPC canonical preflight, so the
 * proxy's 308 target can never drift from the route's (rollback path) or the
 * page's own canonicalization. Pure string logic — middleware-safe.
 */
export interface StorefrontPdpCanonicalSource {
  canonical_url?: string | null;
  category?: string | null;
  categories?:
    | { name?: string | null; slug?: string | null }
    | { name?: string | null; slug?: string | null }[]
    | null;
  condition?: string | null;
  condition_detail?: string | null;
  id: string;
  name: string;
  slug?: string | null;
}

function asProductUrlSource(value: StorefrontPdpCanonicalSource) {
  const category = Array.isArray(value.categories)
    ? (value.categories[0] ?? null)
    : (value.categories ?? null);

  return {
    canonical_url: value.canonical_url,
    category: value.category,
    categories: category?.slug
      ? {
          name: category.name ?? undefined,
          slug: category.slug,
        }
      : null,
    condition: value.condition ?? undefined,
    condition_detail: value.condition_detail ?? undefined,
    id: value.id,
    name: value.name,
    slug: value.slug ?? undefined,
  };
}

/**
 * Collapses a public PDP path to its `/{category}/{slug}` shape, mapping known
 * public category aliases to their canonical slug so alias forms of the same
 * URL compare equal.
 */
export function normalizeStorefrontPublicPdpPath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    return pathname.replace(/\/+$/g, '') || '/';
  }

  const [category, slug] = segments;
  const normalizedCategory =
    normalizeStorefrontCategorySlug(category) ?? category;
  return `/${normalizedCategory}/${slug}`;
}

export function normalizeStorefrontPdpPathForCompare(path: string): string {
  return normalizeStorefrontPublicPdpPath(path).toLowerCase();
}

/**
 * Composes the canonical public PDP path for a product row. `canonical_url`
 * is explicitly nulled: stored canonical URLs can go stale, so the canonical
 * decision is always derived from the product's live category/slug fields.
 */
export function buildStorefrontPdpCanonicalPath(
  source: StorefrontPdpCanonicalSource
): string {
  return normalizeStorefrontPublicPdpPath(
    getProductUrl({
      ...asProductUrlSource(source),
      canonical_url: null,
    })
  );
}
