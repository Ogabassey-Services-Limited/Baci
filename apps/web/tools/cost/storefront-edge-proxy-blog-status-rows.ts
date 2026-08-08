import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { createStorefrontEdgeProxyClass } from './storefront-edge-proxy-class';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

/** Merchant-data blog post and listing hard-status proxy verdicts. */
export const STOREFRONT_EDGE_PROXY_BLOG_STATUS_ROWS: readonly InventoryRow[] = [
  createStorefrontEdgeProxyClass(
    'proxy:blog-post-status-redirect',
    '/blog/{postSlug}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'resolved_blog_post_status_redirect',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'blog_post_status_redirect',
      },
    }
  ),
  createStorefrontEdgeProxyClass(
    'proxy:blog-post-status-missing',
    '/blog/{postSlug}',
    ['GET', 'HEAD'],
    'edge_terminal',
    'resolved_blog_post_status_missing',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'blog_post_status_missing',
      },
    }
  ),
  createStorefrontEdgeProxyClass(
    'proxy:blog-listing-status-redirect',
    '/blog/{*listingPath?}',
    ['GET', 'HEAD'],
    'edge_redirect',
    'resolved_blog_listing_status_redirect',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'blog_listing_status_redirect',
      },
    }
  ),
  createStorefrontEdgeProxyClass(
    'proxy:blog-listing-status-missing',
    '/blog/{*listingPath?}',
    ['GET', 'HEAD'],
    'edge_terminal',
    'resolved_blog_listing_status_missing',
    {
      pathCondition: {
        precedence: 'before_path_decision',
        predicate: 'blog_listing_status_missing',
      },
    }
  ),
];
