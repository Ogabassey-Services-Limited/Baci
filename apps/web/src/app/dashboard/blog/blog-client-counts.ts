import type { BlogCounts, BlogPost } from './blog-client-types';

export function updateCountsForStatus(
  counts: BlogCounts | null | undefined,
  from: BlogPost['status'],
  to: BlogPost['status']
): BlogCounts | null | undefined {
  if (!counts || from === to) return counts;
  return {
    ...counts,
    [from]: Math.max(0, counts[from] - 1),
    [to]: counts[to] + 1,
  };
}

export function updateCountsForDeletion(
  counts: BlogCounts | null | undefined,
  post: BlogPost,
  direction: -1 | 1
): BlogCounts | null | undefined {
  if (!counts) return counts;
  return {
    ...counts,
    [post.status]: Math.max(0, counts[post.status] + direction),
    total: Math.max(0, counts.total + direction),
  };
}
