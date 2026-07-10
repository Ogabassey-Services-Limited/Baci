import { resolveLowestPricedVariantSelection } from '@baci/shared/lib';
import { buildOgabasseyPrewarmTransformUrls } from '@/lib/ogabassey-image-prewarm';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';
import { getPrimaryProductImage } from '@/lib/product-image';

/**
 * Enumeration half of the one-time image-format backfill: paginate the
 * production catalog (active products' primary images + published blog
 * posts' featured images) and expand each source image into the EXACT
 * transform-variant URLs production requests, via the same builder the
 * prewarm path uses — a second hand-maintained matrix would silently drift.
 *
 * Any Supabase query error THROWS: the caller purges Cloudflare's cache
 * based on this inventory, and purging from an incomplete inventory must be
 * impossible (verify-then-act, mirroring scripts/backfill-feed-images.ts).
 */

const PAGE_SIZE = 1000;

interface BackfillQueryResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

interface BackfillQueryBuilder {
  eq(column: string, value: string): BackfillQueryBuilder;
  order(column: string, options: { ascending: boolean }): BackfillQueryBuilder;
  range(from: number, to: number): PromiseLike<BackfillQueryResult>;
}

/** Minimal structural slice of a Supabase client — injectable for tests. */
export interface ImageFormatBackfillSupabaseClient {
  from(table: string): { select(columns: string): BackfillQueryBuilder };
}

export interface ImageFormatBackfillTargets {
  /** Active products scanned. */
  productCount: number;
  /** Published blog posts scanned. */
  blogPostCount: number;
  /** Unique transform-variant URLs across both sources. */
  urls: string[];
}

async function fetchStatusRows(
  supabase: ImageFormatBackfillSupabaseClient,
  table: string,
  columns: string,
  status: string,
  limit?: number
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  for (;;) {
    // Cap the window by the remaining limit so a small sample run (--limit)
    // does not fetch a full 1000-row page just to slice it locally.
    const pageSize =
      limit !== undefined
        ? Math.min(PAGE_SIZE, limit - rows.length)
        : PAGE_SIZE;
    const rangeEnd = offset + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('status', status)
      // Stable order is REQUIRED for range pagination: without it later
      // pages can overlap or skip rows, silently leaving poisoned variants
      // out of a run that reports a full scan.
      .order('id', { ascending: true })
      .range(offset, rangeEnd);

    if (error) {
      throw new Error(
        `Failed to fetch ${table} rows ${offset}-${rangeEnd}: ${error.message}`
      );
    }

    const page = data ?? [];
    rows.push(...page);

    if (limit !== undefined && rows.length >= limit) {
      return rows.slice(0, limit);
    }
    if (page.length < pageSize) {
      return rows;
    }
    offset += pageSize;
  }
}

interface BackfillVariantRow {
  id: string;
  images?: unknown;
  price_override?: number | null;
  primary_image?: string | null;
  stock_quantity?: number | null;
}

function extractDefaultVariantImage(
  row: Record<string, unknown>
): string | null {
  // The PDP opens on the LOWEST-PRICED purchasable variant
  // (resolveLowestPricedVariantSelection — the exact production resolver),
  // and renders `variant.primary_image || variant.images?.[0]` above the
  // fold; when that differs from the product primary, THAT is the LCP URL.
  // Only the default selection's image is included: other variants render on
  // user interaction, so their cold cost is never on the critical path and
  // warming all of them would multiply the run size for large matrices.
  const variants = (
    Array.isArray(row.product_variants) ? row.product_variants : []
  ).filter(
    (variant): variant is BackfillVariantRow =>
      Boolean(variant) &&
      typeof variant === 'object' &&
      typeof (variant as BackfillVariantRow).id === 'string'
  );
  if (variants.length === 0) {
    return null;
  }

  const selection = resolveLowestPricedVariantSelection({
    manage_stock:
      typeof row.manage_stock === 'boolean' ? row.manage_stock : null,
    price: typeof row.price === 'number' ? row.price : 0,
    variants,
  });
  const variant = selection?.variant ?? null;
  if (!variant) {
    return null;
  }
  if (typeof variant.primary_image === 'string' && variant.primary_image) {
    return variant.primary_image;
  }
  const images = Array.isArray(variant.images) ? variant.images : [];
  const first = images.find((image) => typeof image === 'string' && image);
  return typeof first === 'string' ? first : null;
}

function addProductVariantUrls(
  productRows: Record<string, unknown>[],
  urls: Set<string>
): void {
  for (const row of productRows) {
    const sources = [
      getPrimaryProductImage(Array.isArray(row.images) ? row.images : null),
      extractDefaultVariantImage(row),
    ];
    for (const source of sources) {
      if (!source) {
        continue;
      }
      // Default pairs = the product surfaces' matrix (PDP hero + listing card).
      for (const url of buildOgabasseyPrewarmTransformUrls(source, undefined, {
        format: 'auto',
      })) {
        urls.add(url);
      }
    }
  }
}

function addBlogVariantUrls(
  blogRows: Record<string, unknown>[],
  urls: Set<string>
): void {
  for (const row of blogRows) {
    const featuredImage =
      typeof row.featured_image_url === 'string'
        ? row.featured_image_url
        : null;
    if (!featuredImage) {
      continue;
    }
    for (const url of buildOgabasseyPrewarmTransformUrls(
      featuredImage,
      BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
      { format: 'auto' }
    )) {
      urls.add(url);
    }
  }
}

/**
 * Enumerate every production transform-variant URL the backfill must check.
 * `limit` caps active products and `blogLimit` independently caps published
 * blog posts for a bounded sample run. Omitting either limit scans that source
 * in full. Throws on any query error.
 */
export async function enumerateImageFormatBackfillTargets(
  supabase: ImageFormatBackfillSupabaseClient,
  options: { blogLimit?: number; limit?: number } = {}
): Promise<ImageFormatBackfillTargets> {
  const productRows = await fetchStatusRows(
    supabase,
    'products',
    'id, images, price, manage_stock, product_variants!product_variants_product_id_fkey(id, primary_image, images, price_override, stock_quantity)',
    'active',
    options.limit
  );
  const blogRows = await fetchStatusRows(
    supabase,
    'blog_posts',
    'featured_image_url',
    'published',
    options.blogLimit
  );

  const urls = new Set<string>();
  addProductVariantUrls(productRows, urls);
  addBlogVariantUrls(blogRows, urls);

  return {
    productCount: productRows.length,
    blogPostCount: blogRows.length,
    urls: Array.from(urls),
  };
}
