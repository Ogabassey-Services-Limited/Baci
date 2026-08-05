import type { PublishedClusterPost } from './content-cluster-types';
import { getPostTokenGroups } from './get-post-token-groups';
import { isVariantOnlyComparisonSegment } from './is-variant-only-comparison-segment';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

const COMPARISON_BOUNDARY_TOKENS = new Set([
  'against',
  'and',
  'or',
  'versus',
  'vs',
]);

function tokenizeIdentifier(identifier: string) {
  return normalizeContentCurrencyTokens(identifier)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function countIdentifierOccurrences(tokens: string[], identifier: string) {
  const identifierTokens = tokenizeIdentifier(identifier);
  if (identifierTokens.length === 0) {
    return 0;
  }

  return tokens.filter((_, index) =>
    identifierTokens.every((token, offset) => tokens[index + offset] === token)
  ).length;
}

function getComparisonSegments(tokens: string[]) {
  return tokens.reduce<string[][]>(
    (segments, token) => {
      if (COMPARISON_BOUNDARY_TOKENS.has(token)) {
        segments.push([]);
      } else {
        segments.at(-1)?.push(token);
      }
      return segments;
    },
    [[]]
  );
}

function countComparisonSegmentsForIdentifier(
  segments: string[][],
  identifier: string
) {
  let count = 0;
  let canInheritIdentifier = false;
  for (const segment of segments) {
    const hasIdentifier = countIdentifierOccurrences(segment, identifier) > 0;
    const isVariantOnlyContinuation =
      canInheritIdentifier &&
      !hasIdentifier &&
      isVariantOnlyComparisonSegment(segment);
    if (hasIdentifier || isVariantOnlyContinuation) {
      count += 1;
      canInheritIdentifier = true;
    } else {
      canInheritIdentifier = false;
    }
  }
  return count;
}

/** Ensures same-model compare variants are represented by separate occurrences. */
export function hasDistinctCompareIdentifierOccurrences(
  post: PublishedClusterPost,
  identifiers: string[]
) {
  const requiredCounts = new Map<string, number>();
  for (const identifier of identifiers) {
    requiredCounts.set(identifier, (requiredCounts.get(identifier) ?? 0) + 1);
  }

  return getPostTokenGroups(post).some((tokens) => {
    const comparisonSegments = getComparisonSegments(tokens);
    return Array.from(requiredCounts).every(
      ([identifier, count]) =>
        countComparisonSegmentsForIdentifier(comparisonSegments, identifier) >=
        count
    );
  });
}
