import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

const OPENAI_FEED_PRODUCTS_PAGE_SIZE = 1000;
const MAX_OPENAI_FEED_PRODUCTS = 50_000;
const OPENAI_FEED_PRODUCTS_SELECT = `id, name, description, slug, canonical_url, price, compare_at_price, images,
       brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition, google_product_category, category,
       weight_value, weight_unit, updated_at,
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
  updated_at?: string;
  variants?: OpenAIFeedVariant[];
}

export interface OpenAIFeedData {
  products: OpenAIFeedProduct[];
}

async function fetchActiveOpenAIFeedProducts(
  supabase: SupabaseClient,
  merchantId: string
): Promise<OpenAIFeedProduct[]> {
  const products: OpenAIFeedProduct[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select(OPENAI_FEED_PRODUCTS_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + OPENAI_FEED_PRODUCTS_PAGE_SIZE - 1);

    if (error) {
      console.error('DB_PRODUCTS_ERROR:', { error, merchantId, offset });
      throw new Error('Failed to fetch products');
    }

    const page = (data || []) as OpenAIFeedProduct[];
    const remaining = MAX_OPENAI_FEED_PRODUCTS - products.length;
    products.push(...page.slice(0, remaining));

    if (
      page.length < OPENAI_FEED_PRODUCTS_PAGE_SIZE ||
      products.length >= MAX_OPENAI_FEED_PRODUCTS
    ) {
      break;
    }

    offset += OPENAI_FEED_PRODUCTS_PAGE_SIZE;
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
