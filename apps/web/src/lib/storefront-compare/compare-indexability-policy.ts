import type { ComparableProductKeySpecs } from '@/lib/storefront-specs/spec-taxonomy';
import {
  buildCategorySupportLinks,
  buildProductSupportLinks,
} from './build-commercial-support-links';
import { parseCompareSlug } from './compare-slugs';

interface CompareIndexabilityProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: ComparableProductKeySpecs | null;
}

function extractCompareSlugFromHref(href: string, categorySlug: string) {
  let pathname = '';

  try {
    pathname = new URL(href, 'https://placeholder.local').pathname;
  } catch {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const compareSegmentIndex = segments.findIndex(
    (segment, index) =>
      segment === 'compare' && segments[index - 1] === categorySlug
  );

  return compareSegmentIndex >= 0
    ? segments[compareSegmentIndex + 1] || null
    : null;
}

function addCanonicalCompareSlug(slugs: Set<string>, slug: string | null) {
  if (!slug) {
    return;
  }

  const parsed = parseCompareSlug(slug);

  if (parsed) {
    slugs.add(parsed.canonicalSlug);
  }
}

export function buildCuratedCompareSlugSet(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareIndexabilityProduct[];
}) {
  const slugs = new Set<string>();
  const categoryLinks = buildCategorySupportLinks(input);
  const productLinks = input.products.flatMap((product) =>
    buildProductSupportLinks({
      storeUrl: input.storeUrl,
      categorySlug: input.categorySlug,
      currentProductSlug: product.slug,
      currentProductPrice: product.price,
      products: input.products,
    })
  );

  for (const link of [...categoryLinks, ...productLinks]) {
    addCanonicalCompareSlug(
      slugs,
      extractCompareSlugFromHref(link.href, input.categorySlug)
    );
  }

  return slugs;
}

export function buildApprovedCompareSlugsForCategory(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareIndexabilityProduct[];
}) {
  return [...buildCuratedCompareSlugSet(input)].sort();
}

export function isCuratedCompareSlug(
  slug: string,
  curatedSlugs: ReadonlySet<string>
) {
  const parsed = parseCompareSlug(slug);
  return Boolean(parsed && curatedSlugs.has(parsed.canonicalSlug));
}
