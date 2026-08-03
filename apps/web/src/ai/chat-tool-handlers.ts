import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticMerchantIdentity } from '@/lib/agentic/agentic-merchant-identity';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import {
  handleCheckPaymentStatus as handleCheckPaymentStatusWithClient,
  handleCreateVirtualAccount as handleCreateVirtualAccountWithClient,
} from './chat-tool-payment-handlers';
import {
  handleAddToCart as handleAddToCartWithClient,
  handleGetProductDetails as handleGetProductDetailsWithClient,
  handleGetRecommendations as handleGetRecommendationsWithClient,
  handleSearchProducts as handleSearchProductsWithClient,
} from './chat-tool-product-handlers';
import type {
  AddToCartParams,
  CheckPaymentStatusParams,
  CreateVirtualAccountParams,
  GetProductDetailsParams,
  GetRecommendationsParams,
  SearchProductsParams,
} from './chat-tools';

export type ChatToolSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

function createChatToolSupabaseClient(
  merchant: AgenticMerchantIdentity,
  sessionId?: string
): ChatToolSupabaseClient {
  return createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
    sessionId,
  });
}

export function handleSearchProducts(
  params: SearchProductsParams,
  merchant: AgenticMerchantIdentity
) {
  return handleSearchProductsWithClient(
    params,
    merchant,
    createChatToolSupabaseClient(merchant)
  );
}

export function handleGetProductDetails(
  params: GetProductDetailsParams,
  merchant: AgenticMerchantIdentity
) {
  return handleGetProductDetailsWithClient(
    params,
    merchant,
    createChatToolSupabaseClient(merchant)
  );
}

export function handleCreateVirtualAccount(
  params: CreateVirtualAccountParams,
  sessionId: string,
  merchant: AgenticMerchantIdentity
) {
  return handleCreateVirtualAccountWithClient(
    params,
    sessionId,
    merchant,
    createChatToolSupabaseClient(merchant, sessionId)
  );
}

export function handleCheckPaymentStatus(
  params: CheckPaymentStatusParams,
  sessionId: string,
  merchant: AgenticMerchantIdentity
) {
  return handleCheckPaymentStatusWithClient(
    params,
    sessionId,
    merchant,
    createChatToolSupabaseClient(merchant, sessionId)
  );
}

export function handleGetRecommendations(
  params: GetRecommendationsParams,
  merchant: AgenticMerchantIdentity
) {
  return handleGetRecommendationsWithClient(
    params,
    merchant,
    createChatToolSupabaseClient(merchant)
  );
}

export function handleAddToCart(
  params: AddToCartParams,
  merchant: AgenticMerchantIdentity
) {
  return handleAddToCartWithClient(
    params,
    merchant,
    createChatToolSupabaseClient(merchant)
  );
}
