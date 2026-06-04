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
  type CheckPaymentStatusParams,
  type CreateVirtualAccountParams,
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
        const result = await handleCheckPaymentStatus(params);
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
