import type { PublishedClusterPost } from './content-cluster-types';
import { tokenizeContentText } from './tokenize-content-text';

type PostTokenGroupSource = Pick<
  PublishedClusterPost,
  'title' | 'excerpt' | 'category' | 'tags' | 'keywords'
>;

export function getPostTokenGroups(post: PostTokenGroupSource) {
  return [
    post.title,
    post.excerpt,
    post.category,
    ...(post.tags ?? []),
    ...(post.keywords ?? []),
  ].map((value) =>
    tokenizeContentText(value?.replace(/\//gu, ' versus ') ?? '')
  );
}
