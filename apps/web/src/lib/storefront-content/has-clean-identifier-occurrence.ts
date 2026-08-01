import type { PublishedClusterPost } from './content-cluster-types';
import { tokenizeContentText } from './tokenize-content-text';

const MODEL_VARIANT_MARKER_TOKENS = new Set([
  'active',
  'classic',
  'edge',
  'fe',
  'flip',
  'fold',
  'lite',
  'max',
  'mini',
  'neo',
  'plus',
  'power',
  'prime',
  'pro',
  'se',
  'ultra',
  'xl',
]);
const MODEL_GENERATION_SUFFIX_PATTERN = /^\d{1,2}(?:st|nd|rd|th)?$/u;
const MAX_BRAND_TOKEN_DISTANCE = 3;

interface IdentifierOccurrenceOptions {
  brand?: string | null;
  knownBrands?: string[];
  brandAliases?: Record<string, readonly string[]>;
  discriminatorTokens?: string[];
}

function matchesTokenSequence(
  tokens: string[],
  expectedTokens: string[],
  startIndex: number
) {
  return expectedTokens.every(
    (token, offset) => tokens[startIndex + offset] === token
  );
}

function matchesOrderedTokenSequence(
  tokens: string[],
  expectedTokens: string[]
) {
  let expectedIndex = 0;
  for (const token of tokens) {
    if (token === expectedTokens[expectedIndex]) {
      expectedIndex += 1;
      if (expectedIndex === expectedTokens.length) {
        return true;
      }
    }
  }
  return expectedTokens.length === 0;
}

function getBrandDistance(
  brandTokens: string[],
  identifierStart: number,
  identifierEnd: number,
  brandStart: number
) {
  const brandEnd = brandStart + brandTokens.length;
  if (brandEnd <= identifierStart) {
    return identifierStart - brandEnd;
  }
  if (brandStart >= identifierEnd) {
    return brandStart - identifierEnd;
  }
  return 0;
}

function isBrandQualifiedOccurrence(
  tokens: string[],
  identifierStart: number,
  identifierEnd: number,
  requestedBrand: string,
  knownBrands: string[],
  brandAliases: Record<string, readonly string[]>
) {
  const brandCandidates = Array.from(
    new Set([requestedBrand, ...knownBrands])
  ).flatMap((brand) =>
    [brand, ...(brandAliases[brand] ?? [])]
      .map((candidate) => ({ brand, tokens: tokenizeContentText(candidate) }))
      .filter(({ tokens: brandTokens }) => brandTokens.length > 0)
  );
  let nearestBrand: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of brandCandidates) {
    for (
      let index = 0;
      index <= tokens.length - candidate.tokens.length;
      index += 1
    ) {
      if (!matchesTokenSequence(tokens, candidate.tokens, index)) {
        continue;
      }
      const distance = getBrandDistance(
        candidate.tokens,
        identifierStart,
        identifierEnd,
        index
      );
      if (distance <= MAX_BRAND_TOKEN_DISTANCE && distance < nearestDistance) {
        nearestBrand = candidate.brand;
        nearestDistance = distance;
      }
    }
  }

  return nearestBrand === requestedBrand;
}

/** Finds a model phrase while excluding obvious variant and generation suffixes. */
export function hasCleanIdentifierOccurrence(
  post: PublishedClusterPost,
  identifierTokens: string[],
  options: IdentifierOccurrenceOptions = {}
) {
  const postTokenGroups = [
    post.title,
    post.excerpt,
    post.category,
    ...(post.tags ?? []),
    ...(post.keywords ?? []),
  ].map(tokenizeContentText);

  return postTokenGroups.some((postTokens) =>
    postTokens.some((_, startIndex) => {
      const matchesIdentifier = matchesTokenSequence(
        postTokens,
        identifierTokens,
        startIndex
      );
      const suffix = postTokens[startIndex + identifierTokens.length] ?? '';
      if (
        !matchesIdentifier ||
        MODEL_VARIANT_MARKER_TOKENS.has(suffix) ||
        MODEL_GENERATION_SUFFIX_PATTERN.test(suffix)
      ) {
        return false;
      }

      if (
        options.discriminatorTokens?.length &&
        !matchesOrderedTokenSequence(postTokens, options.discriminatorTokens)
      ) {
        return false;
      }

      return options.brand
        ? isBrandQualifiedOccurrence(
            postTokens,
            startIndex,
            startIndex + identifierTokens.length,
            options.brand,
            options.knownBrands ?? [],
            options.brandAliases ?? {}
          )
        : true;
    })
  );
}
