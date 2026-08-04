import type { PublishedClusterPost } from './content-cluster-types';
import { tokenizeContentText } from './tokenize-content-text';

type PostTokenGroupSource = Pick<
  PublishedClusterPost,
  'title' | 'excerpt' | 'category' | 'tags' | 'keywords'
>;

const COMPARISON_CUE_PATTERN = /\b(?:compare|comparison|versus|vs)\b/iu;
const MODEL_TOKEN_PATTERN = /\b(?:\d+[a-z]+|[a-z]+\d+|\d+)\b/iu;

function normalizeComparisonSeparators(value: string) {
  const hasComparisonCue = COMPARISON_CUE_PATTERN.test(value);
  return value.replace(/\s+[&/]\s+/gu, (separator, offset: number) => {
    const left = value.slice(0, offset);
    const right = value.slice(offset + separator.length);
    return hasComparisonCue ||
      (MODEL_TOKEN_PATTERN.test(left) && MODEL_TOKEN_PATTERN.test(right))
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
