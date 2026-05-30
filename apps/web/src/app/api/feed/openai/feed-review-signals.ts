import type { SupabaseClient } from '@supabase/supabase-js';
import type { OpenAIFeedProduct } from './feed-data';

const OPENAI_FEED_REVIEW_ROWS_PAGE_SIZE = 1000;
const OPENAI_FEED_REVIEW_PRODUCTS_CHUNK_SIZE = 200;

type RawOpenAIFeedReviewSignalRow = {
  product_id: string | null;
  rating: number | string | null;
};

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

export async function hydrateOpenAIFeedProductsWithReviewSignals(
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
