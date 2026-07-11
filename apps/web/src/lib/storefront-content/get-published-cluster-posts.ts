import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { buildClusterGuideSearchQuery } from './build-cluster-guide-search-query';
import type {
  BuildCommercialGuideLinksContext,
  PublishedClusterPost,
} from './content-cluster-types';

const CLUSTER_GUIDE_CANDIDATE_LIMIT = 64;

type StorefrontClusterRule = {
  rule_order: number;
  category_slug: string;
  category_names: string[];
  article_tokens: string[];
};

// Keep the database pre-cap classifier aligned with the semantic classifier
// that performs the final guide scoring. The RPC validates and bounds this
// public rule payload before using it.
const STOREFRONT_CLUSTER_RULES: StorefrontClusterRule[] = Object.entries(
  CONTENT_CLUSTER_SUPPORT
).map(([categorySlug, support], ruleOrder) => ({
  rule_order: ruleOrder,
  category_slug: categorySlug,
  category_names: [...support.categoryNames],
  article_tokens: [...support.articleTokens],
}));

type StorefrontClusterGuideDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_storefront_cluster_guide_candidates_v1: {
        Args: {
          p_category_slug: string;
          p_cluster_rules: StorefrontClusterRule[];
          p_merchant_id: string;
          p_search_query: string;
          p_limit?: number;
        };
        Returns: PublishedClusterPost[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Loads only context-relevant public guide candidates from the database.
 *
 * Cached LOCALLY — deliberately `'use cache'`, not `'use cache: remote'`. The
 * prior rejection (see git history on this file / PR #3017) targeted an
 * UNBOUNDED ~400KB `'use cache: remote'` entry that cached a merchant's
 * entire published blog corpus and was re-written to Vercel's managed data
 * cache every 60s; that remote-write path (RemoteCacheHandler 502/503 ->
 * unhandled rejection -> process exit) was the dominant source of storefront
 * cache failures, independent of this function's argument shape. The RPC
 * below already bounds every response to <=64 relevance-ranked rows via
 * SQL LIMIT, so the unbounded-payload condition no longer holds, and a local
 * entry never takes the remote write path at all. Cache Components keys each
 * entry on the full argument tuple (merchantId + context), so a product/
 * compare/category/price-band request can never be served another request's
 * cached rows.
 *
 * Errors escape so the page-level optional-content boundary can fail open
 * without persisting an empty result.
 */
export async function getPublishedClusterPosts(
  merchantId: string,
  context: BuildCommercialGuideLinksContext
): Promise<PublishedClusterPost[]> {
  'use cache';
  try {
    // 'blog' (revalidate 3600, expire 86400): matches getCachedBlogPost — this
    // read is bounded and index-backed, so the merchant-wide unbounded-payload
    // condition that forced the old cache off a long revalidate window no
    // longer applies. Tag parity with getCachedBlogPost/revalidateBlogPosts
    // (`blog-posts`), revalidateProducts (`products-${merchantId}`), and
    // revalidateFeatures (`features-${merchantId}`, since the blog_enabled
    // gate now lives inside the RPC instead of a nested cached call) so a
    // post publish/edit or a blog_enabled toggle busts every cached context
    // for this merchant instead of waiting out the TTL.
    cacheLife('blog');
    cacheTag('blog-posts', `products-${merchantId}`, `features-${merchantId}`);
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  // The repository has not generated a global Database type yet. Keep the
  // assertion at this RPC adapter boundary so Supabase can type the set-return
  // contract correctly; overrideTypes() cannot turn the default scalar Json
  // fallback for an unknown RPC into an array on current postgrest-js.
  const supabase =
    getPublicSupabaseClient() as SupabaseClient<StorefrontClusterGuideDatabase>;
  const { data, error } = await supabase.rpc(
    'get_storefront_cluster_guide_candidates_v1',
    {
      p_category_slug: context.categorySlug,
      p_cluster_rules: STOREFRONT_CLUSTER_RULES,
      p_merchant_id: merchantId,
      p_search_query: buildClusterGuideSearchQuery(context),
      p_limit: CLUSTER_GUIDE_CANDIDATE_LIMIT,
    }
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}
