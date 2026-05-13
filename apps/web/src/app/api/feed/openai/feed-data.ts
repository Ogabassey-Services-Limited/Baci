import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

const OPENAI_FEED_PRODUCTS_PAGE_SIZE = 1000;
// Keep parity with Google feed product coverage until variant hydration supports
// catalogs above 10k products across both machine-readable surfaces.
const MAX_OPENAI_FEED_PRODUCTS = 10_000;
const OPENAI_FEED_PRODUCTS_SELECT = `id, name, description, slug, canonical_url, price, compare_at_price, images,
       brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition, google_product_category, category,
       weight_value, weight_unit, created_at, updated_at,
       categories:category_id(name, slug),
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
  categories?: { name?: string | null; slug?: string | null } | null;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  created_at?: string | null;
  updated_at?: string;
  variants?: OpenAIFeedVariant[];
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

    const page = (data || []) as OpenAIFeedProduct[];
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
  merchantId: string
): Promise<OpenAIFeedData> {
  'use cache: remote';
  cacheLife('products');
  cacheTag('openai-product-feed', 'products', `merchant-feed-${merchantId}`);

  const supabase = createAnonClient();

  return {
    products: await fetchActiveOpenAIFeedProducts(supabase, merchantId),
  };
}
