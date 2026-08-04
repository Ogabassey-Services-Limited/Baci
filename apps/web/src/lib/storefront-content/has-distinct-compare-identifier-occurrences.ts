import type { PublishedClusterPost } from './content-cluster-types';
import { getPostTokenGroups } from './get-post-token-groups';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

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

/** Ensures same-model compare variants are represented by separate occurrences. */
export function hasDistinctCompareIdentifierOccurrences(
  post: PublishedClusterPost,
  identifiers: string[]
) {
  const requiredCounts = new Map<string, number>();
  for (const identifier of identifiers) {
    requiredCounts.set(identifier, (requiredCounts.get(identifier) ?? 0) + 1);
  }

  return getPostTokenGroups(post).some((tokens) =>
    Array.from(requiredCounts).every(
      ([identifier, count]) =>
        countIdentifierOccurrences(tokens, identifier) >= count
    )
  );
}
