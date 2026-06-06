import { handleCancelOrder } from '@/ai/chat-order-cancellation';
import {
  handleAddToCart,
  handleCheckPaymentStatus,
  handleCreateVirtualAccount,
  handleGetProductDetails,
  handleGetRecommendations,
  handleSearchProducts,
} from '@/ai/chat-tool-handlers';
import {
  type AddToCartParams,
  addToCartSchema,
  type CancelOrderParams,
  type CheckPaymentStatusParams,
  type CreateVirtualAccountParams,
  cancelOrderSchema,
  checkPaymentStatusSchema,
  createVirtualAccountSchema,
  type GetProductDetailsParams,
  type GetRecommendationsParams,
  getProductDetailsSchema,
  getRecommendationsSchema,
  type SearchProductsParams,
  searchProductsSchema,
  TOOL_DESCRIPTIONS,
} from '@/ai/chat-tools';

export function createAiSdkAgenticChatTools(sessionId: string) {
  return {
    searchProducts: {
      description: TOOL_DESCRIPTIONS.searchProducts,
      inputSchema: searchProductsSchema,
      execute: async (params: SearchProductsParams) => {
        const result = await handleSearchProducts(params);
        return JSON.stringify(result);
      },
    },
    getProductDetails: {
      description: TOOL_DESCRIPTIONS.getProductDetails,
      inputSchema: getProductDetailsSchema,
      execute: async (params: GetProductDetailsParams) => {
        const result = await handleGetProductDetails(params);
        return JSON.stringify(result);
      },
    },
    createVirtualAccount: {
      description: TOOL_DESCRIPTIONS.createVirtualAccount,
      inputSchema: createVirtualAccountSchema,
      execute: async (params: CreateVirtualAccountParams) => {
        const result = await handleCreateVirtualAccount(params, sessionId);
        return JSON.stringify(result);
      },
    },
    checkPaymentStatus: {
      description: TOOL_DESCRIPTIONS.checkPaymentStatus,
      inputSchema: checkPaymentStatusSchema,
      execute: async (params: CheckPaymentStatusParams) => {
        const result = await handleCheckPaymentStatus(params, sessionId);
        return JSON.stringify(result);
      },
    },
    cancelOrder: {
      description: TOOL_DESCRIPTIONS.cancelOrder,
      inputSchema: cancelOrderSchema,
      execute: async (params: CancelOrderParams) => {
        // Order cancellation must work for existing storefront orders, not only
        // orders created in this chat session. The handler verifies merchant
        // scope, order reference, customer email, and cancellable order status.
        const result = await handleCancelOrder(params);
        return JSON.stringify(result);
      },
    },
    getRecommendations: {
      description: TOOL_DESCRIPTIONS.getRecommendations,
      inputSchema: getRecommendationsSchema,
      execute: async (params: GetRecommendationsParams) => {
        const result = await handleGetRecommendations(params);
        return JSON.stringify(result);
      },
    },
    addToCart: {
      description: TOOL_DESCRIPTIONS.addToCart,
      inputSchema: addToCartSchema,
      execute: async (params: AddToCartParams) => {
        const result = await handleAddToCart(params);
        return JSON.stringify(result);
      },
    },
  };
}
