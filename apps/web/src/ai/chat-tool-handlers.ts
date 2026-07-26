/**
 * Chat Tool Handlers
 *
 * Implements the actual logic for each AI tool.
 * These handlers are called when the AI invokes a tool.
 */

import { resolveAgenticChatTenant } from '@/lib/agentic/agentic-chat-tenant';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { sanitizeSearchQuery } from '@/lib/sanitize-core';
import { searchStorefrontProducts } from '@/lib/storefront-search';
import {
  checkPaymentStatusForTenant,
  createVirtualAccountForTenant,
} from './chat-payment-tool-handlers';
import { getRecommendationsForTenant } from './chat-recommendation-tool-handlers';
import type {
  ChatToolTenantClient,
  PaymentStatusResult,
  ProductSearchResult,
  VirtualAccountResult,
} from './chat-tool-result-types';
import type {
  AddToCartParams,
  CheckPaymentStatusParams,
  CreateVirtualAccountParams,
  GetProductDetailsParams,
  GetRecommendationsParams,
  SearchProductsParams,
} from './chat-tools';

// The copilot tenant is resolved from BACI_AGENTIC_MERCHANT_SLUG rather than a
// hardcoded merchant UUID, so these tools work outside production and can be
// repointed without a deploy. Every handler fails closed when it is unresolvable.

async function createChatToolTenantClient(
  sessionId?: string
): Promise<ChatToolTenantClient | null> {
  const tenant = await resolveAgenticChatTenant();
  if (!tenant) return null;

  const { merchantId, merchantSlug } = tenant;
  const scope =
    sessionId === undefined
      ? { merchantId, merchantSlug }
      : { merchantId, merchantSlug, sessionId };

  return {
    merchantId,
    supabase: createAgenticScopedSupabaseClient(scope),
  };
}

// ============================================
// SEARCH PRODUCTS
// ============================================

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
  params: SearchProductsParams
): Promise<{ products: ProductSearchResult[]; total: number }> {
  const scoped = await createChatToolTenantClient();
  if (!scoped) {
    return { products: [], total: 0 };
  }
  const { merchantId, supabase } = scoped;

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
        merchantId,
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
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(10);

  if (ranked) {
    if (ranked.productIds.length === 0) {
      return { products: [], total: ranked.count };
    }
    query = query.in('id', ranked.productIds);
  }

  // Apply price filters
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

// ============================================
// GET PRODUCT DETAILS
// ============================================

export async function handleGetProductDetails(
  params: GetProductDetailsParams
): Promise<ProductSearchResult | null> {
  const scoped = await createChatToolTenantClient();
  if (!scoped) {
    return null;
  }
  const { merchantId, supabase } = scoped;

  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, price, description, brand, category, images, stock, status'
      )
      .eq('id', params.productId)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      if (error) {
        console.error('[Chat Tools] Product detail error:', error);
      }
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
  } catch (err) {
    console.error('[Chat Tools] Product detail error:', err);
    return null;
  }
}

export async function handleCreateVirtualAccount(
  params: CreateVirtualAccountParams,
  sessionId: string
): Promise<VirtualAccountResult> {
  const scoped = await createChatToolTenantClient(sessionId);
  if (!scoped) {
    console.error('[Chat Tools] Copilot tenant is not configured');
    return { success: false, error: 'Failed to create order' };
  }
  return createVirtualAccountForTenant(params, sessionId, scoped);
}

export async function handleCheckPaymentStatus(
  params: CheckPaymentStatusParams,
  sessionId: string
): Promise<PaymentStatusResult> {
  const scoped = await createChatToolTenantClient(sessionId);
  return scoped
    ? checkPaymentStatusForTenant(params, sessionId, scoped)
    : { status: 'not_found' };
}

export async function handleGetRecommendations(
  params: GetRecommendationsParams
): Promise<ProductSearchResult[]> {
  const scoped = await createChatToolTenantClient();
  return scoped ? getRecommendationsForTenant(params, scoped) : [];
}

// ============================================
// ADD TO CART (Returns product for frontend)
// ============================================

export function handleAddToCart(
  params: AddToCartParams
): Promise<ProductSearchResult | null> {
  // Just return the product details - actual cart management happens on frontend
  return handleGetProductDetails({ productId: params.productId });
}
