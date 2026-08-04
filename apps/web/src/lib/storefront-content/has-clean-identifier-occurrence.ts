import type { PublishedClusterPost } from './content-cluster-types';
import { getPostTokenGroups } from './get-post-token-groups';
import { matchesVariantDiscriminatorTokens } from './matches-variant-discriminator-tokens';
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
const COMPARISON_BOUNDARY_TOKENS = new Set([
  'against',
  'and',
  'or',
  'versus',
  'vs',
]);

interface IdentifierOccurrenceOptions {
  brand?: string | null;
  knownBrands?: string[];
  brandAliases?: Record<string, readonly string[]>;
  discriminatorTokens?: string[];
  allowPartialDiscriminatorGroups?: boolean;
  requireBrandBeforeIdentifier?: boolean;
  allowBrandAliasOverlap?: boolean;
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

function matchesDiscriminatorForIdentifierOccurrence(
  tokens: string[],
  identifierStart: number,
  identifierEnd: number,
  discriminatorTokens: string[],
  allowPartialGroups: boolean
) {
  const previousBoundary = tokens.findLastIndex(
    (token, index) =>
      index < identifierStart && COMPARISON_BOUNDARY_TOKENS.has(token)
  );
  const nextBoundary = tokens.findIndex(
    (token, index) =>
      index >= identifierEnd && COMPARISON_BOUNDARY_TOKENS.has(token)
  );
  const occurrenceTokens = tokens.slice(
    previousBoundary + 1,
    nextBoundary >= 0 ? nextBoundary : tokens.length
  );
  return matchesVariantDiscriminatorTokens(
    occurrenceTokens,
    discriminatorTokens,
    allowPartialGroups
  );
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
  brandAliases: Record<string, readonly string[]>,
  requireBrandBeforeIdentifier: boolean,
  allowBrandAliasOverlap: boolean
) {
  const brandCandidates = Array.from(
    new Set([requestedBrand, ...knownBrands])
  ).flatMap((brand) =>
    [brand, ...(brandAliases[brand] ?? [])]
      .filter((candidate, index) => index === 0 || !(candidate in brandAliases))
      .map((candidate, index) => ({
        brand,
        isAlias: index > 0,
        tokens: tokenizeContentText(candidate),
      }))
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
      const isRetainedRequestedBrand =
        candidate.brand === requestedBrand &&
        index === identifierStart &&
        index + candidate.tokens.length <= identifierEnd;
      if (
        requireBrandBeforeIdentifier &&
        index + candidate.tokens.length > identifierStart &&
        !(
          candidate.isAlias &&
          allowBrandAliasOverlap &&
          index <= identifierStart
        ) &&
        !isRetainedRequestedBrand
      ) {
        continue;
      }
      const distance = getBrandDistance(
        candidate.tokens,
        identifierStart,
        identifierEnd,
        index
      );
      if (distance < nearestDistance) {
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
  if (identifierTokens.length === 0) {
    return false;
  }

  const postTokenGroups = getPostTokenGroups(post);

  return postTokenGroups.some((postTokens) =>
    postTokens.some((_, startIndex) => {
      const matchesIdentifier = matchesTokenSequence(
        postTokens,
        identifierTokens,
        startIndex
      );
      const suffix = postTokens[startIndex + identifierTokens.length] ?? '';
      const nextSuffix =
        postTokens[startIndex + identifierTokens.length + 1] ?? '';
      const followingSuffix =
        postTokens[startIndex + identifierTokens.length + 2] ?? '';
      const listicleSuffix = new RegExp(
        `${identifierTokens.join('\\s+')}\\s*[:—–-]\\s*\\d+`,
        'iu'
      ).test(post.title);
      const displaySizeSuffix =
        (/^\d{1,2}$/u.test(suffix) && ['in', 'inch'].includes(nextSuffix)) ||
        (/^\d{1,2}$/u.test(suffix) &&
          /^\d$/u.test(nextSuffix) &&
          ['in', 'inch'].includes(followingSuffix));
      if (
        !matchesIdentifier ||
        MODEL_VARIANT_MARKER_TOKENS.has(suffix) ||
        (MODEL_GENERATION_SUFFIX_PATTERN.test(suffix) &&
          !listicleSuffix &&
          !displaySizeSuffix)
      ) {
        return false;
      }

      if (
        options.discriminatorTokens?.length &&
        !matchesDiscriminatorForIdentifierOccurrence(
          postTokens,
          startIndex,
          startIndex + identifierTokens.length,
          options.discriminatorTokens,
          options.allowPartialDiscriminatorGroups ?? false
        )
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
            options.brandAliases ?? {},
            options.requireBrandBeforeIdentifier ?? false,
            options.allowBrandAliasOverlap ?? false
          )
        : true;
    })
  );
}
