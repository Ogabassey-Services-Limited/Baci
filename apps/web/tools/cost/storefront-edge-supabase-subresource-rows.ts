import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const PUCK_STOREFRONT_SOURCE =
  'apps/web/src/components/storefront/puck-storefront.tsx';
const BLOG_SNIPPET_SOURCE =
  'apps/web/src/components/storefront/ogabassey/components/BlogSnippet.tsx';

function supabaseSubresource(
  id: string,
  routePattern: string,
  methods: InventoryRow['methods'],
  sourcePath: string
): InventoryRow {
  return {
    decision: 'origin_dynamic',
    destinationCondition: {
      hostKind: 'configured_supabase_origin',
      precedence: 'before_path_decision',
    },
    id: `automatic-subresource:supabase-${id}`,
    methods,
    reason: 'browser_supabase_query_requires_external_origin',
    routePattern,
    sourceKind: 'automatic_subresource',
    sourcePath,
  };
}

/** Direct browser-to-Supabase requests emitted by released storefront islands. */
export const STOREFRONT_EDGE_SUPABASE_SUBRESOURCE_ROWS: readonly InventoryRow[] =
  [
    supabaseSubresource(
      'page-configs',
      '/rest/v1/page_configs',
      ['GET'],
      PUCK_STOREFRONT_SOURCE
    ),
    supabaseSubresource(
      'blog-post-products',
      '/rest/v1/blog_post_products',
      ['GET'],
      BLOG_SNIPPET_SOURCE
    ),
    supabaseSubresource(
      'products',
      '/rest/v1/products',
      ['GET'],
      BLOG_SNIPPET_SOURCE
    ),
    supabaseSubresource(
      'match-blog-to-product',
      '/rest/v1/rpc/match_blog_to_product',
      ['POST'],
      BLOG_SNIPPET_SOURCE
    ),
    supabaseSubresource(
      'blog-posts',
      '/rest/v1/blog_posts',
      ['GET'],
      BLOG_SNIPPET_SOURCE
    ),
  ];
