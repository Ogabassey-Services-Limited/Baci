import { z } from 'zod';

/**
 * RPC function names — shared constants so the two PDP helpers issue
 * byte-identical calls (the transport memo collapses them into one round trip
 * per navigation).
 */
export const STOREFRONT_PDP_PREFLIGHT_RPC = 'get_storefront_pdp_preflight';
export const STOREFRONT_BLOG_POST_STATUS_RPC =
  'get_storefront_blog_post_status';

/**
 * Row contracts for the storefront preflight verdict RPCs
 * (`get_storefront_pdp_preflight`, `get_storefront_blog_post_status` —
 * supabase/migrations/20260706200000_add_storefront_preflight_rpcs.sql).
 *
 * PostgREST returns table-returning RPC results as an array of rows; both
 * functions guarantee EXACTLY one row for any input (invalid/oversized input
 * degrades to `storefront_status: 'unknown'`). `storefront_status` is kept a
 * tolerant string (not a literal union) so a mixed-deploy caller never
 * hard-fails parsing a future status value — consumers compare against the
 * known values and fail open otherwise.
 */
export const storefrontPdpPreflightRowSchema = z.object({
  storefront_status: z.string(),
  catalog_nonempty: z.boolean(),
  present: z.boolean(),
  match_kind: z.string(),
  product_id: z.string().nullable(),
  product_name: z.string().nullable(),
  product_slug: z.string().nullable(),
  product_category: z.string().nullable(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  category_slug: z.string().nullable(),
});

export type StorefrontPdpPreflightRow = z.infer<
  typeof storefrontPdpPreflightRowSchema
>;

export const storefrontBlogPostStatusRowSchema = z.object({
  storefront_status: z.string(),
  blog_enabled: z.boolean(),
  live_present: z.boolean(),
  redirect_target_slug: z.string().nullable(),
});

export type StorefrontBlogPostStatusRow = z.infer<
  typeof storefrontBlogPostStatusRowSchema
>;
