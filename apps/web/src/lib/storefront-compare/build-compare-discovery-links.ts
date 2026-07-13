import {
  buildCategoryPriceBandCandidates,
  buildCategorySupportLinks,
  buildProductSupportLinks,
  type CommercialSupportLink,
} from './build-commercial-support-links';
import { parseCompareSlug } from './compare-slugs';

interface CompareDiscoveryProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

interface CompareDiscoveryInput {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  includeBrandCompareLinks?: boolean;
  products: CompareDiscoveryProduct[];
  requiredProductSlugs?: string[];
}

export const PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT = 150;

export interface CompareDiscoveryLink extends CommercialSupportLink {
  canonicalSlug: string;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

function extractCategoryCompareSlug(href: string, categorySlug: string) {
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

function humanizeCompareKey(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildCompareLabel(input: {
  fallbackLabel: string;
  leftKey: string;
  productNamesBySlug: Map<string, string>;
  rightKey: string;
}) {
  const leftName =
    input.productNamesBySlug.get(input.leftKey) ??
    humanizeCompareKey(input.leftKey);
  const rightName =
    input.productNamesBySlug.get(input.rightKey) ??
    humanizeCompareKey(input.rightKey);

  if (
    input.productNamesBySlug.has(input.leftKey) &&
    input.productNamesBySlug.has(input.rightKey)
  ) {
    return `${leftName} vs ${rightName}`;
  }

  if (/^compare with\b/i.test(input.fallbackLabel)) {
    return `${leftName} vs ${rightName}`;
  }

  return input.fallbackLabel || `${leftName} vs ${rightName}`;
}

function normalizeCompareDiscoveryLink(input: {
  categorySlug: string;
  link: CommercialSupportLink;
  productNamesBySlug: Map<string, string>;
  storeUrl: string;
}): CompareDiscoveryLink | null {
  const compareSlug = extractCategoryCompareSlug(
    input.link.href,
    input.categorySlug
  );
  const parsed = compareSlug ? parseCompareSlug(compareSlug) : null;

  if (!parsed) {
    return null;
  }

  return {
    canonicalSlug: parsed.canonicalSlug,
    href: `${trimTrailingSlash(input.storeUrl)}/${input.categorySlug}/compare/${parsed.canonicalSlug}`,
    label: buildCompareLabel({
      fallbackLabel: input.link.label,
      leftKey: parsed.leftKey,
      productNamesBySlug: input.productNamesBySlug,
      rightKey: parsed.rightKey,
    }),
  };
}

function dedupeLinks<T extends CommercialSupportLink>(links: T[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    if (seen.has(link.href)) {
      return false;
    }

    seen.add(link.href);
    return true;
  });
}

function buildProductScopedDiscoveryWindow(input: {
  limit: number;
  products: CompareDiscoveryProduct[];
  requiredProductSlugs?: string[];
}) {
  const requiredSlugs = new Set(
    (input.requiredProductSlugs ?? [])
      .map((slug) => slug.trim())
      .filter(Boolean)
  );
  const seenSlugs = new Set<string>();
  const windowProducts: CompareDiscoveryProduct[] = [];

  for (const product of input.products) {
    if (!requiredSlugs.has(product.slug) || seenSlugs.has(product.slug)) {
      continue;
    }

    seenSlugs.add(product.slug);
    windowProducts.push(product);
  }

  for (const product of input.products) {
    if (seenSlugs.has(product.slug)) {
      continue;
    }

    seenSlugs.add(product.slug);
    windowProducts.push(product);

    if (windowProducts.length >= input.limit) {
      break;
    }
  }

  return windowProducts.slice(0, input.limit);
}

function buildProductScopedSupportLinks(input: CompareDiscoveryInput) {
  const products = buildProductScopedDiscoveryWindow({
    limit: PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT,
    products: input.products,
    requiredProductSlugs: input.requiredProductSlugs,
  });

  // Hoist the product-invariant price-band candidate list: it depends only on
  // (categorySlug, products) and was previously rebuilt inside every one of the
  // up-to-150 buildProductSupportLinks calls below. Compute once, reuse.
  const priceBandCandidates = buildCategoryPriceBandCandidates(
    input.categorySlug,
    products
  );

  return products.flatMap((product) =>
    buildProductSupportLinks({
      storeUrl: input.storeUrl,
      categorySlug: input.categorySlug,
      currentProductSlug: product.slug,
      currentProductPrice: product.price,
      includeBrandCompareLink: false,
      products,
      priceBandCandidates,
    })
  );
}

export function buildCompareDiscoveryLinks(
  input: CompareDiscoveryInput
): CompareDiscoveryLink[] {
  const productNamesBySlug = new Map(
    input.products.map((product) => [product.slug, product.name])
  );
  const links = [
    ...buildCategorySupportLinks({
      ...input,
      includeBrandCompareLink: input.includeBrandCompareLinks,
    }),
    ...buildProductScopedSupportLinks(input),
  ];

  return dedupeLinks(
    links
      .map((link) =>
        normalizeCompareDiscoveryLink({
          categorySlug: input.categorySlug,
          link,
          productNamesBySlug,
          storeUrl: input.storeUrl,
        })
      )
      .filter((link): link is CompareDiscoveryLink => link !== null)
  );
}

export function buildCommercialSupportDiscoveryLinks(
  input: CompareDiscoveryInput
): CommercialSupportLink[] {
  const storeUrl = trimTrailingSlash(input.storeUrl);
  const categorySupportLinks = buildCategorySupportLinks({
    ...input,
    storeUrl,
    includeBrandCompareLink: input.includeBrandCompareLinks,
  }).filter(
    (link) => extractCategoryCompareSlug(link.href, input.categorySlug) === null
  );

  return dedupeLinks([
    ...buildCompareDiscoveryLinks({ ...input, storeUrl }),
    ...categorySupportLinks,
  ]);
}
