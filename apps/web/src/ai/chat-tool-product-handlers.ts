import type { AgenticMerchantIdentity } from '@/lib/agentic/agentic-merchant-identity';
import { sanitizeSearchQuery } from '@/lib/sanitize-core';
import { searchStorefrontProducts } from '@/lib/storefront-search';
import type { ChatToolSupabaseClient } from './chat-tool-handlers';
import type {
  AddToCartParams,
  GetProductDetailsParams,
  GetRecommendationsParams,
  SearchProductsParams,
} from './chat-tools';

export interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  description: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  status: string;
}

function buildChatSearchText(params: SearchProductsParams): string {
  return [params.query, params.category]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => sanitizeSearchQuery(value).trim())
    .filter(Boolean)
    .join(' ');
}

function orderProductsByRankedIds<T extends { id: string }>(
  products: T[],
  rankedIds: string[]
): T[] {
  const order = new Map(rankedIds.map((id, index) => [id, index] as const));
  return [...products].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

export async function handleSearchProducts(
  params: SearchProductsParams,
  merchant: AgenticMerchantIdentity,
  supabase: ChatToolSupabaseClient
): Promise<{ products: ProductSearchResult[]; total: number }> {
  const searchText = buildChatSearchText(params);
  let ranked: Awaited<ReturnType<typeof searchStorefrontProducts>> | null =
    null;

  if (searchText) {
    try {
      ranked = await searchStorefrontProducts({
        supabase,
        filters: {
          maxPrice: params.maxPrice ?? null,
          minPrice: params.minPrice ?? null,
        },
        limit: 10,
        merchantId: merchant.id,
        query: searchText,
        trackAnalytics: false,
      });
    } catch (error) {
      console.error('[Chat Tools] Search ranking error:', error);
      return { products: [], total: 0 };
    }
  }

  let query = supabase
    .from('products')
    .select(
      'id, name, price, description, brand, category, images, stock, status'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(10);

  if (ranked) {
    if (ranked.productIds.length === 0) {
      return { products: [], total: ranked.count };
    }
    query = query.in('id', ranked.productIds);
  }

  if (params.maxPrice !== undefined) {
    query = query.lte('price', params.maxPrice);
  }
  if (params.minPrice !== undefined) {
    query = query.gte('price', params.minPrice);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Chat Tools] Search error:', error);
    return { products: [], total: 0 };
  }

  const mappedProducts = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description,
    brand: p.brand,
    category: p.category,
    image_url:
      Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
    stock: p.stock,
    status: p.status,
  }));
  const products = ranked
    ? orderProductsByRankedIds(mappedProducts, ranked.productIds)
    : mappedProducts;

  return { products, total: ranked?.count ?? (count || products.length) };
}

export async function handleGetProductDetails(
  params: GetProductDetailsParams,
  merchant: AgenticMerchantIdentity,
  supabase: ChatToolSupabaseClient
): Promise<ProductSearchResult | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, price, description, brand, category, images, stock, status'
      )
      .eq('id', params.productId)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      if (error) console.error('[Chat Tools] Product detail error:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      price: data.price,
      description: data.description,
      brand: data.brand,
      category: data.category,
      image_url:
        Array.isArray(data.images) && data.images[0]?.url
          ? data.images[0].url
          : null,
      stock: data.stock,
      status: data.status,
    };
  } catch (error) {
    console.error('[Chat Tools] Product detail error:', error);
    return null;
  }
}

export async function handleGetRecommendations(
  params: GetRecommendationsParams,
  merchant: AgenticMerchantIdentity,
  supabase: ChatToolSupabaseClient
): Promise<ProductSearchResult[]> {
  try {
    const { data: sourceProduct, error: sourceError } = await supabase
      .from('products')
      .select('id, name, price, category, brand')
      .eq('id', params.productId)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .maybeSingle();

    if (sourceError || !sourceProduct) {
      if (sourceError)
        console.error('[Chat Tools] Source product error:', sourceError);
      return [];
    }

    let query = supabase
      .from('products')
      .select(
        'id, name, price, description, brand, category, images, stock, status'
      )
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .neq('id', params.productId)
      .limit(3);

    if (params.type === 'upsell') {
      query = query
        .eq('category', sourceProduct.category)
        .gt('price', sourceProduct.price * 1.1)
        .lt('price', sourceProduct.price * 1.5)
        .order('price', { ascending: true });
    } else if (params.type === 'cross_sell') {
      query = query
        .in('category', getComplementaryCategories(sourceProduct.category))
        .order('price', { ascending: false });
    } else {
      query = query
        .eq('brand', sourceProduct.brand)
        .lt('price', sourceProduct.price * 0.3)
        .order('price', { ascending: false });
    }

    const { data, error: recommendationError } = await query;
    if (recommendationError) {
      console.error('[Chat Tools] Recommendations error:', recommendationError);
      return [];
    }

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      brand: p.brand,
      category: p.category,
      image_url:
        Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
      stock: p.stock,
      status: p.status,
    }));
  } catch (error) {
    console.error('[Chat Tools] Recommendations error:', error);
    return [];
  }
}

function getComplementaryCategories(category: string | null): string[] {
  const categoryPairs: Record<string, string[]> = {
    Smartphones: ['Accessories', 'Tablets', 'Wearables'],
    Laptops: ['Accessories', 'Monitors', 'Keyboards'],
    Gaming: ['Accessories', 'Monitors', 'Headphones'],
    Tablets: ['Accessories', 'Keyboards', 'Styluses'],
    Audio: ['Accessories', 'Smartphones', 'Wearables'],
  };

  return categoryPairs[category || ''] || ['Accessories'];
}

export function handleAddToCart(
  params: AddToCartParams,
  merchant: AgenticMerchantIdentity,
  supabase: ChatToolSupabaseClient
): Promise<ProductSearchResult | null> {
  return handleGetProductDetails(
    { productId: params.productId },
    merchant,
    supabase
  );
}
