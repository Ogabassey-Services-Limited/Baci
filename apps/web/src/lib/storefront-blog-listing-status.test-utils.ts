import { vi } from 'vitest';
import type { StorefrontBlogListingStatusRow } from '@/schemas/storefront-preflight-rpc';
import type {
  StorefrontPreflightRpcImpl,
  StorefrontPreflightRpcResult,
} from './storefront-preflight-rpc';

/**
 * Shared blog-listing preflight test scaffolding.
 *
 * The default fixtures mirror the live ogabassey listing data validated against
 * the RPC on prod: 515 total published posts (43 pages), Smartphones=228 (19),
 * Laptops=80 (7), Reviews=15 (2). `Smart Phones`/`Smart-Phones` both slugify to
 * `smart-phones`, exercising the collision → NOOP branch.
 */
export function makeBlogListingRow(
  overrides: Partial<StorefrontBlogListingStatusRow> = {}
): StorefrontBlogListingStatusRow {
  return {
    storefront_status: 'published',
    blog_enabled: true,
    total_count: 515,
    categories: [
      'Smartphones',
      'Laptops',
      'Reviews',
      'Smart Phones',
      'Smart-Phones',
    ],
    category_counts: [228, 80, 15, 3, 4],
    author_count: 0,
    ...overrides,
  };
}

export function rpcImplResolving(row: unknown): StorefrontPreflightRpcImpl {
  return vi.fn(
    async (): Promise<StorefrontPreflightRpcResult> => ({
      data: [row],
      error: null,
    })
  );
}

/** Repeatedly percent-encodes a seed to the `%2525…` bot signature. */
export function overEncoded(seed: string): string {
  let slug = seed;
  for (let i = 0; i < 10; i++) {
    slug = encodeURIComponent(slug);
  }
  return slug;
}
