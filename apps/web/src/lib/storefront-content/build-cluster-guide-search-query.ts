import type { ClusterSupport } from '@/config/storefront-content-cluster-shared';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';

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
  const rawTerms = [
    ...support.categoryNames,
    ...getContextBrandTerms(context),
    ...(context.productSlugs ?? []).map((slug) => slug.replace(/-/g, ' ')),
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
