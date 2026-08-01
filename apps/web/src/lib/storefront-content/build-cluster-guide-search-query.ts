import type { ClusterSupport } from '@/config/storefront-content-cluster-shared';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

const MAX_SEARCH_QUERY_LENGTH = 512;
const MAX_SEARCH_TERM_LENGTH = 80;
const WEBSEARCH_OPERATOR_WORDS = new Set(['and', 'not', 'or']);
const UTF8_ENCODER = new TextEncoder();

function normalizeSearchTerm(value: string): string {
  const words = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length > 0 &&
        word.length <= MAX_SEARCH_TERM_LENGTH &&
        !WEBSEARCH_OPERATOR_WORDS.has(word)
    );
  const accepted: string[] = [];

  for (const word of words) {
    const candidate = [...accepted, word].join(' ');
    if (candidate.length > MAX_SEARCH_TERM_LENGTH) {
      break;
    }
    accepted.push(word);
  }

  return accepted.join(' ');
}

function getContextBrandTerms(
  context: BuildCommercialGuideLinksContext
): string[] {
  const support = CONTENT_CLUSTER_SUPPORT[context.categorySlug];
  const terms: string[] = [];

  for (const brand of context.brands ?? []) {
    const normalizedBrand = normalizeSearchTerm(brand);
    if (!normalizedBrand) {
      continue;
    }

    terms.push(normalizedBrand);

    for (const [brandKey, aliases] of Object.entries(support.brandTokens)) {
      const normalizedAliases = [brandKey, ...aliases]
        .map(normalizeSearchTerm)
        .filter(Boolean);
      if (normalizedAliases.includes(normalizedBrand)) {
        terms.push(...normalizedAliases);
      }
    }
  }

  return terms;
}

function spreadTerms(terms: string[]) {
  if (terms.length < 3) {
    return terms;
  }

  const bucketCount = Math.min(8, terms.length);
  const spread: string[] = [];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    for (let index = bucket; index < terms.length; index += bucketCount) {
      spread.push(terms[index]);
    }
  }
  return spread;
}

function getCompactCategoryProductTerm(identifier: string) {
  const tokens = identifier
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) {
    return '';
  }

  // The RPC query is only a candidate prefilter. Keep one model discriminator
  // per product so a long authority catalog does not exhaust the 512-byte
  // budget before later products are searchable. Full identifiers remain in
  // buildCommercialGuideLinks for the exact downstream score.
  return (
    tokens.find((token) => /\d/u.test(token)) ??
    [...tokens].sort((left, right) => right.length - left.length)[0] ??
    ''
  );
}

export function buildClusterGuideSearchQuery(
  context: BuildCommercialGuideLinksContext
): string {
  // CONTENT_CLUSTER_SUPPORT deliberately preserves literal keys so config
  // completeness is checked at compile time. Widen the selected entry to the
  // public support contract before indexing its runtime price-band slug.
  const support: ClusterSupport = CONTENT_CLUSTER_SUPPORT[context.categorySlug];
  const priceBandTerms = context.priceBandSlug
    ? (support.priceBandAliases[context.priceBandSlug] ?? [])
    : [];
  const productTerms =
    context.pageKind === 'category'
      ? spreadTerms(
          getProductModelIdentifiers(context).map(getCompactCategoryProductTerm)
        )
      : (context.productSlugs ?? []).map((slug) => slug.replace(/-/g, ' '));
  const rawTerms = [
    ...support.categoryNames,
    ...getContextBrandTerms(context),
    ...productTerms,
    ...priceBandTerms,
    ...support.articleTokens,
  ];
  const seen = new Set<string>();
  const expressions: string[] = [];
  let queryByteLength = 0;

  for (const rawTerm of rawTerms) {
    const term = normalizeSearchTerm(rawTerm);
    if (!term || seen.has(term)) {
      continue;
    }

    const expression = `"${term}"`;
    const separatorLength = expressions.length > 0 ? 4 : 0;
    const expressionByteLength = UTF8_ENCODER.encode(expression).byteLength;
    if (
      queryByteLength + separatorLength + expressionByteLength >
      MAX_SEARCH_QUERY_LENGTH
    ) {
      continue;
    }

    seen.add(term);
    expressions.push(expression);
    queryByteLength += separatorLength + expressionByteLength;
  }

  return expressions.join(' OR ');
}
