import type { BuildCommercialGuideLinksInput } from './content-cluster-types';
import { hasCleanIdentifierOccurrence } from './has-clean-identifier-occurrence';

function getIdentifierCandidates(
  identifierTokens: string[],
  inferredTokens: string[]
) {
  const modelCode = identifierTokens.at(-1) ?? '';
  if (identifierTokens.length < 2 || !/^\d{3,}$/u.test(modelCode)) {
    return [identifierTokens];
  }
  const familyTokens = identifierTokens.slice(0, -1);
  const displayFamilyCandidates = inferredTokens
    .filter((token) => /^\d{1,2}$/u.test(token))
    .map((token) => [...familyTokens, token, modelCode]);
  return [identifierTokens, ...displayFamilyCandidates];
}

/** Matches a model phrase while rejecting unbranded numeric-only references. */
export function matchesProductGuideIdentifier(
  post: BuildCommercialGuideLinksInput['posts'][number],
  inferredTokens: string[],
  identifierTokens: string[],
  hasBrandMatch: boolean,
  occurrenceOptions?: Parameters<typeof hasCleanIdentifierOccurrence>[2]
) {
  const identifierCandidates = getIdentifierCandidates(
    identifierTokens,
    inferredTokens
  );
  if (
    identifierTokens.length === 0 ||
    (identifierTokens.every((token) => /^\d+$/u.test(token)) &&
      !hasBrandMatch &&
      !occurrenceOptions?.brand) ||
    !identifierCandidates.some((candidate) =>
      candidate.every((token) => inferredTokens.includes(token))
    )
  ) {
    return false;
  }
  return identifierCandidates.some(
    (candidate) =>
      candidate.every((token) => inferredTokens.includes(token)) &&
      hasCleanIdentifierOccurrence(post, candidate, occurrenceOptions)
  );
}
