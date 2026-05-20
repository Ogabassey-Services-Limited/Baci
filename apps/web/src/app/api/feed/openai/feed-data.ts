import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

const OPENAI_FEED_PRODUCTS_PAGE_SIZE = 1000;
// Keep parity with Google feed product coverage until variant hydration supports
// catalogs above 10k products across both machine-readable surfaces.
const MAX_OPENAI_FEED_PRODUCTS = 10_000;
const OPENAI_FEED_REVIEW_ROWS_PAGE_SIZE = 1000;
const OPENAI_FEED_REVIEW_PRODUCTS_CHUNK_SIZE = 200;
const OPENAI_FEED_PRODUCTS_SELECT = `id, name, description, slug, canonical_url, price, compare_at_price, images,
       brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition, google_product_category, category,
       weight_value, weight_unit, created_at, updated_at,
       categories:category_id(name, slug),
       product_categories(categories(name, slug)),
       variants:product_variants!product_variants_product_id_fkey(id, attributes, price_override, stock_quantity, sku, primary_image)`;

export interface OpenAIFeedVariant {
  id: string;
  attributes: Record<string, string>;
  price_override?: number;
  stock_quantity?: number;
  sku?: string;
  primary_image?: string;
}

export interface OpenAIFeedProduct {
  id: string;
  name: string;
  description: string;
  slug?: string;
  canonical_url?: string | null;
  price: number;
  compare_at_price?: number;
  images?: string[] | Array<{ url: string; alt?: string }>;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean | null;
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  category_slug?: string | null;
  average_rating?: number | null;
  review_count?: number | null;
  categories?: { name?: string | null; slug?: string | null } | null;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  created_at?: string | null;
  updated_at?: string;
  variants?: OpenAIFeedVariant[];
}

interface RawOpenAIFeedProductRow extends OpenAIFeedProduct {
  product_categories?: Array<{
    categories?: { name?: string | null; slug?: string | null } | null;
  }> | null;
}

interface RawOpenAIFeedReviewSignalRow {
  product_id: string | null;
  rating: number | string | null;
}

export interface OpenAIFeedData {
  products: OpenAIFeedProduct[];
}

interface OpenAIFeedProductCursor {
  createdAt: string;
  id: string;
}

function getOpenAIFeedCursor(
  page: OpenAIFeedProduct[]
): OpenAIFeedProductCursor | null {
  for (let index = page.length - 1; index >= 0; index -= 1) {
    const row = page[index];
    if (row?.created_at) {
      return {
        createdAt: row.created_at,
        id: row.id,
      };
    }
  }

  return null;
}

function getJoinedCategory(
  product: RawOpenAIFeedProductRow
): { name?: string | null; slug?: string | null } | null {
  return (
    product.categories ?? product.product_categories?.[0]?.categories ?? null
  );
}

function normalizeOpenAIFeedProducts(
  products: RawOpenAIFeedProductRow[]
): OpenAIFeedProduct[] {
  return products.map((product) => {
    const { product_categories: _productCategories, ...rest } = product;
    const joinedCategory = getJoinedCategory(product);

    return {
      ...rest,
      categories: joinedCategory ?? null,
      category_slug: joinedCategory?.slug ?? null,
      category: rest.category ?? joinedCategory?.name ?? undefined,
    };
  });
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function chunkValues<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function withApprovedReviewSignals(
  products: OpenAIFeedProduct[],
  reviewStatsByProductId: Map<string, { count: number; ratingTotal: number }>
): OpenAIFeedProduct[] {
  return products.map((product) => {
    const stats = reviewStatsByProductId.get(product.id);

    if (!stats || stats.count <= 0) {
      return {
        ...product,
        average_rating: null,
        review_count: 0,
      };
    }

    return {
      ...product,
      average_rating: Math.round((stats.ratingTotal / stats.count) * 10) / 10,
      review_count: stats.count,
    };
  });
}

async function fetchApprovedReviewSignalStats(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: string[]
): Promise<Map<string, { count: number; ratingTotal: number }>> {
  const reviewStatsByProductId = new Map<
    string,
    { count: number; ratingTotal: number }
  >();

  for (const productIdChunk of chunkValues(
    productIds,
    OPENAI_FEED_REVIEW_PRODUCTS_CHUNK_SIZE
  )) {
    let offset = 0;
    let requestedExactCount = false;
    let totalRows: number | null = null;

    while (true) {
      const shouldRequestExactCount = !requestedExactCount;
      requestedExactCount = true;
      const reviewQuery = supabase.from('product_reviews');
      const selectQuery = shouldRequestExactCount
        ? reviewQuery.select('product_id, rating', { count: 'exact' })
        : reviewQuery.select('product_id, rating');
      const { count, data, error } = await selectQuery
        .eq('merchant_id', merchantId)
        .eq('status', 'approved')
        .in('product_id', productIdChunk)
        .order('product_id', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + OPENAI_FEED_REVIEW_ROWS_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const rows = (data || []) as RawOpenAIFeedReviewSignalRow[];
      if (shouldRequestExactCount && typeof count === 'number') {
        totalRows = count;
      }
      for (const row of rows) {
        if (!row.product_id) continue;

        const rating = toFiniteNumber(row.rating);
        if (rating === null || rating < 0 || rating > 5) {
          continue;
        }

        const current = reviewStatsByProductId.get(row.product_id) ?? {
          count: 0,
          ratingTotal: 0,
        };
        reviewStatsByProductId.set(row.product_id, {
          count: current.count + 1,
          ratingTotal: current.ratingTotal + rating,
        });
      }

      if (rows.length === 0) {
        break;
      }

      const nextOffset = offset + rows.length;
      if (totalRows !== null && nextOffset >= totalRows) {
        break;
      }
      if (
        totalRows === null &&
        rows.length < OPENAI_FEED_REVIEW_ROWS_PAGE_SIZE
      ) {
        break;
      }

      offset = nextOffset;
    }
  }

  return reviewStatsByProductId;
}

async function hydrateProductsWithReviewSignals(
  supabase: SupabaseClient,
  merchantId: string,
  products: OpenAIFeedProduct[]
): Promise<OpenAIFeedProduct[]> {
  if (products.length === 0) return products;

  const productIds = products.map((product) => product.id);
  if (productIds.length === 0) return products;

  try {
    const reviewStatsByProductId = await fetchApprovedReviewSignalStats(
      supabase,
      merchantId,
      productIds
    );
    return withApprovedReviewSignals(products, reviewStatsByProductId);
  } catch (error) {
    console.warn('DB_REVIEW_SIGNAL_WARNING:', {
      error,
      merchantId,
      productCount: productIds.length,
    });
    return products.map((product) => ({
      ...product,
      average_rating: null,
      review_count: null,
    }));
  }
}

async function fetchActiveOpenAIFeedProducts(
  supabase: SupabaseClient,
  merchantId: string
): Promise<OpenAIFeedProduct[]> {
  const products: OpenAIFeedProduct[] = [];
  let cursor: OpenAIFeedProductCursor | null = null;
  let readNullCreatedAtRows = false;
  let nullCreatedAtCursorId: string | null = null;

  while (true) {
    let query = supabase
      .from('products')
      .select(OPENAI_FEED_PRODUCTS_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    if (readNullCreatedAtRows) {
      query = query.is('created_at', null);

      if (nullCreatedAtCursorId) {
        query = query.gt('id', nullCreatedAtCursorId);
      }
    } else {
      query = query.not('created_at', 'is', null);
    }

    if (!readNullCreatedAtRows && cursor) {
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
      );
    }

    const { data, error } = await (readNullCreatedAtRows
      ? query
          .order('id', { ascending: true })
          .limit(OPENAI_FEED_PRODUCTS_PAGE_SIZE)
      : query
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .limit(OPENAI_FEED_PRODUCTS_PAGE_SIZE));

    if (error) {
      console.error('DB_PRODUCTS_ERROR:', {
        cursor,
        error,
        merchantId,
        readNullCreatedAtRows,
      });
      throw new Error('Failed to fetch products');
    }

    const page = normalizeOpenAIFeedProducts(
      (data || []) as RawOpenAIFeedProductRow[]
    );
    const remaining = MAX_OPENAI_FEED_PRODUCTS - products.length;
    products.push(...page.slice(0, remaining));

    if (products.length >= MAX_OPENAI_FEED_PRODUCTS) {
      break;
    }

    if (page.length < OPENAI_FEED_PRODUCTS_PAGE_SIZE) {
      if (!readNullCreatedAtRows) {
        readNullCreatedAtRows = true;
        nullCreatedAtCursorId = null;
        continue;
      }
      break;
    }

    if (readNullCreatedAtRows) {
      const lastNullCreatedAtProduct = page.at(-1);
      if (!lastNullCreatedAtProduct?.id) {
        break;
      }

      nullCreatedAtCursorId = lastNullCreatedAtProduct.id;
      continue;
    }

    const nextCursor = getOpenAIFeedCursor(page);
    if (!nextCursor) {
      console.warn('DB_PRODUCTS_CURSOR_WARNING:', { merchantId });
      break;
    }

    cursor = nextCursor;
  }

  return products;
}

/**
 * Cached data fetcher for OpenAI product feed.
 * Uses `'use cache'` with the `products` cache profile.
 *
 * Must use `createAnonClient()` (stateless, no request-scoped state)
 * because `'use cache'` functions must not capture request context.
 */
export async function getCachedOpenAIFeedData(
  merchantId: string,
  includeReviewSignals = false
): Promise<OpenAIFeedData> {
  'use cache';
  cacheLife('products');
  cacheTag('openai-product-feed', 'products', `merchant-feed-${merchantId}`);
  if (includeReviewSignals) {
    cacheTag(`merchant-feed-review-signals-${merchantId}`);
  }

  const supabase = createAnonClient();
  const products = await fetchActiveOpenAIFeedProducts(supabase, merchantId);

  return {
    products: includeReviewSignals
      ? await hydrateProductsWithReviewSignals(supabase, merchantId, products)
      : products,
  };
}
