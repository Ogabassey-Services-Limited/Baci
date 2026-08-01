import type { PublishedClusterPost } from './content-cluster-types';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

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

function tokenizeText(value: string | null | undefined) {
  return normalizeContentCurrencyTokens(value ?? '')
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim())
    .filter(Boolean);
}

/** Counts model phrases while excluding obvious variant and generation suffixes. */
export function countCleanIdentifierOccurrences(
  post: PublishedClusterPost,
  identifierTokens: string[]
) {
  const postTokenGroups = [
    post.title,
    post.excerpt,
    post.category,
    ...(post.tags ?? []),
    ...(post.keywords ?? []),
  ].map(tokenizeText);

  return postTokenGroups.reduce(
    (count, postTokens) =>
      count +
      postTokens.filter((_, startIndex) => {
        const matchesIdentifier = identifierTokens.every(
          (token, offset) => postTokens[startIndex + offset] === token
        );
        const suffix = postTokens[startIndex + identifierTokens.length] ?? '';
        return (
          matchesIdentifier &&
          !(
            MODEL_VARIANT_MARKER_TOKENS.has(suffix) ||
            MODEL_GENERATION_SUFFIX_PATTERN.test(suffix)
          )
        );
      }).length,
    0
  );
}
