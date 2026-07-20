import { buildProductCompareCandidate } from './compare-eligibility';

export const CURATED_PRODUCT_COMPARE_LINK_LIMIT = 12;
export const MAX_CURATED_COMPARE_LINKS_PER_PRODUCT = 2;

export interface CuratedCompareProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

const GENERIC_PRODUCT_NAME_TOKENS = new Set([
  'device',
  'laptop',
  'phone',
  'smartphone',
  'tablet',
]);

function productNameTokens(product: CuratedCompareProduct) {
  const brandTokens = new Set(
    (product.brand ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []
  );

  return new Set(
    (product.name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) =>
        token.length > 1 &&
        !brandTokens.has(token) &&
        !GENERIC_PRODUCT_NAME_TOKENS.has(token)
    )
  );
}

function sharedProductNameTokenCount(
  left: CuratedCompareProduct,
  right: CuratedCompareProduct,
  tokenCache: Map<string, Set<string>>
) {
  const leftTokens = tokenCache.get(left.slug) ?? productNameTokens(left);
  const rightTokens = tokenCache.get(right.slug) ?? productNameTokens(right);
  tokenCache.set(left.slug, leftTokens);
  tokenCache.set(right.slug, rightTokens);

  return [...leftTokens].filter((token) => rightTokens.has(token)).length;
}

function pairSubstitutabilityScore(
  left: CuratedCompareProduct,
  right: CuratedCompareProduct,
  tokenCache: Map<string, Set<string>>
) {
  const highestPrice = Math.max(left.price, right.price, 1);
  const priceSimilarity =
    1 - Math.min(Math.abs(left.price - right.price) / highestPrice, 1);
  const leftBrand = left.brand?.trim().toLowerCase();
  const rightBrand = right.brand?.trim().toLowerCase();
  const sameBrand = Boolean(
    leftBrand && rightBrand && leftBrand === rightBrand
  );

  return (
    priceSimilarity * 10 +
    sharedProductNameTokenCount(left, right, tokenCache) * 2 +
    (sameBrand ? 1 : 0)
  );
}

export function curateProductComparePairs(input: {
  categorySlug: string;
  products: CuratedCompareProduct[];
  requiredProductSlugs?: string[];
}) {
  const tokenCache = new Map<string, Set<string>>();
  const requiredSlugs = new Set(input.requiredProductSlugs ?? []);
  const requiredPair =
    requiredSlugs.size === 2 ? [...requiredSlugs].sort().join('\u0000') : null;
  const candidates = input.products.flatMap((leftProduct, leftIndex) =>
    input.products.slice(leftIndex + 1).flatMap((rightProduct) => {
      const candidate = buildProductCompareCandidate({
        categorySlug: input.categorySlug,
        leftProduct,
        rightProduct,
      });

      if (!candidate.isIndexable) {
        return [];
      }

      const pairKey = [leftProduct.slug, rightProduct.slug]
        .sort()
        .join('\u0000');

      return [
        {
          leftProduct,
          rightProduct,
          required: pairKey === requiredPair,
          score: pairSubstitutabilityScore(
            leftProduct,
            rightProduct,
            tokenCache
          ),
        },
      ];
    })
  );
  candidates.sort(
    (left, right) =>
      Number(right.required) - Number(left.required) ||
      right.score - left.score ||
      left.leftProduct.slug.localeCompare(right.leftProduct.slug) ||
      left.rightProduct.slug.localeCompare(right.rightProduct.slug)
  );

  const selected = [];
  const appearances = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= CURATED_PRODUCT_COMPARE_LINK_LIMIT) {
      break;
    }

    const leftCount = appearances.get(candidate.leftProduct.slug) ?? 0;
    const rightCount = appearances.get(candidate.rightProduct.slug) ?? 0;

    if (
      leftCount >= MAX_CURATED_COMPARE_LINKS_PER_PRODUCT ||
      rightCount >= MAX_CURATED_COMPARE_LINKS_PER_PRODUCT
    ) {
      continue;
    }

    appearances.set(candidate.leftProduct.slug, leftCount + 1);
    appearances.set(candidate.rightProduct.slug, rightCount + 1);
    selected.push({
      leftProduct: candidate.leftProduct,
      rightProduct: candidate.rightProduct,
    });
  }

  return selected;
}
