import type { PublishedClusterPost } from './content-cluster-types';
import { tokenizeContentText } from './tokenize-content-text';

type PostTokenGroupSource = Pick<
  PublishedClusterPost,
  'title' | 'excerpt' | 'category' | 'tags' | 'keywords'
>;

const COMPARISON_CUE_PATTERN = /\b(?:compare|comparison|versus|vs)\b/iu;
const MODEL_TOKEN_PATTERN = /\b(?:\d+[a-z]+|[a-z]+\d+|\d+)\b/iu;
const GENERIC_COMPARISON_TOKENS = new Set([
  'buyer',
  'compare',
  'comparison',
  'guide',
  'review',
]);

function hasRepeatedTextModel(left: string, right: string) {
  const leftTokens = new Set(
    tokenizeContentText(left).filter(
      (token) => token.length > 2 && !GENERIC_COMPARISON_TOKENS.has(token)
    )
  );
  const sharedTokens = new Set(
    tokenizeContentText(right).filter((token) => leftTokens.has(token))
  );
  return sharedTokens.size >= 2;
}

function normalizeComparisonSeparators(value: string) {
  const hasComparisonCue = COMPARISON_CUE_PATTERN.test(value);
  return value.replace(/\s*[&/]\s*/gu, (separator, offset: number) => {
    const left = value.slice(0, offset);
    const right = value.slice(offset + separator.length);
    const hasModelOnBothSides =
      MODEL_TOKEN_PATTERN.test(left) && MODEL_TOKEN_PATTERN.test(right);
    const hasTextModelOnBothSides =
      hasComparisonCue && hasRepeatedTextModel(left, right);
    const hasSeparatorWhitespace = /\s/u.test(separator);
    return (hasModelOnBothSides || hasTextModelOnBothSides) &&
      (hasSeparatorWhitespace || hasComparisonCue)
      ? ' versus '
      : separator;
  });
}

export function getPostTokenGroups(post: PostTokenGroupSource) {
  return [
    post.title,
    post.excerpt,
    post.category,
    ...(post.tags ?? []),
    ...(post.keywords ?? []),
  ].map((value) =>
    tokenizeContentText(normalizeComparisonSeparators(value ?? ''))
  );
}
