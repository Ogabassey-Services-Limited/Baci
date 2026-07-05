import type { ComparableProductKeySpecs } from '@/lib/storefront-specs/spec-taxonomy';
import { buildCompareDiscoveryLinks } from './build-compare-discovery-links';
import { parseCompareSlug } from './compare-slugs';

interface CompareIndexabilityProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: ComparableProductKeySpecs | null;
}

interface BuildCuratedCompareSlugSetInput {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareIndexabilityProduct[];
  requiredProductSlugs?: string[];
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

export function buildCuratedCompareSlugSet(
  input: BuildCuratedCompareSlugSetInput
) {
  const slugs = new Set<string>();

  for (const link of buildCompareDiscoveryLinks(input)) {
    addCanonicalCompareSlug(slugs, link.canonicalSlug);
  }

  return slugs;
}

export function buildApprovedCompareSlugsForCategory(
  input: BuildCuratedCompareSlugSetInput
) {
  return [...buildCuratedCompareSlugSet(input)].sort();
}

export function isCuratedCompareSlug(
  slug: string,
  curatedSlugs: ReadonlySet<string>
) {
  const parsed = parseCompareSlug(slug);
  return Boolean(parsed && curatedSlugs.has(parsed.canonicalSlug));
}
