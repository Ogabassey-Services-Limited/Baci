import {
  type BlogDiscoverImageReadinessState,
  classifyBlogDiscoverImageReadiness,
} from '@/lib/blog-discover-readiness';
import type { BlogCounts, BlogPost, BlogStats } from './blog-client-types';

function getStats(posts: BlogPost[], counts?: BlogCounts): BlogStats {
  return {
    total: counts?.total ?? posts.length,
    published:
      counts?.published ??
      posts.filter((post) => post.status === 'published').length,
    drafts:
      counts?.draft ?? posts.filter((post) => post.status === 'draft').length,
    pageViews: posts.reduce((sum, post) => sum + (post.view_count || 0), 0),
  };
}

function getDiscoverReadiness(posts: BlogPost[], merchantId: string) {
  const byPostId = new Map<string, BlogDiscoverImageReadinessState>();
  let remediationCount = 0;
  for (const post of posts) {
    if (post.status !== 'published') continue;
    const readiness = classifyBlogDiscoverImageReadiness(post, merchantId);
    byPostId.set(post.id, readiness);
    if (readiness !== 'ready') remediationCount += 1;
  }
  return { byPostId, remediationCount };
}

export const blogClientDerivedState = { getDiscoverReadiness, getStats };
