import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { buildClusterGuideSearchQuery } from './build-cluster-guide-search-query';
import type {
  BuildCommercialGuideLinksContext,
  PublishedClusterPost,
} from './content-cluster-types';

const CLUSTER_GUIDE_CANDIDATE_LIMIT = 64;

type StorefrontClusterGuideDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_storefront_cluster_guide_candidates_v1: {
        Args: {
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
 * This read is intentionally not wrapped in a Cache Components remote entry:
 * the RPC already bounds the payload and uses the blog full-text index, while
 * the previous high-cardinality remote value was itself a recurring runtime
 * failure source. Errors escape so the page-level optional-content boundary
 * can fail open without persisting an empty result.
 */
export async function getPublishedClusterPosts(
  merchantId: string,
  context: BuildCommercialGuideLinksContext
): Promise<PublishedClusterPost[]> {
  // The repository has not generated a global Database type yet. Keep the
  // assertion at this RPC adapter boundary so Supabase can type the set-return
  // contract correctly; overrideTypes() cannot turn the default scalar Json
  // fallback for an unknown RPC into an array on current postgrest-js.
  const supabase =
    getPublicSupabaseClient() as SupabaseClient<StorefrontClusterGuideDatabase>;
  const { data, error } = await supabase.rpc(
    'get_storefront_cluster_guide_candidates_v1',
    {
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
