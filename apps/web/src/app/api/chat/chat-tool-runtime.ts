import { ZodError } from 'zod';
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

type AgenticChatToolName =
  | 'searchProducts'
  | 'getProductDetails'
  | 'createVirtualAccount'
  | 'checkPaymentStatus'
  | 'getRecommendations'
  | 'addToCart';

const AGENTIC_CHAT_TOOL_NAMES = new Set<AgenticChatToolName>([
  'searchProducts',
  'getProductDetails',
  'createVirtualAccount',
  'checkPaymentStatus',
  'getRecommendations',
  'addToCart',
]);

function isAgenticChatToolName(name: string): name is AgenticChatToolName {
  return AGENTIC_CHAT_TOOL_NAMES.has(name as AgenticChatToolName);
}

function normalizeToolArguments(rawArguments: unknown): unknown {
  if (typeof rawArguments !== 'string') {
    return rawArguments ?? {};
  }

  try {
    return JSON.parse(rawArguments) as unknown;
  } catch {
    return rawArguments;
  }
}

function getToolErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return 'Invalid tool arguments';
  }
  return 'Tool execution failed';
}

function executeAgenticChatTool(
  name: AgenticChatToolName,
  rawArguments: unknown,
  sessionId: string
) {
  const argumentsValue = normalizeToolArguments(rawArguments);

  switch (name) {
    case 'searchProducts':
      return handleSearchProducts(searchProductsSchema.parse(argumentsValue));
    case 'getProductDetails':
      return handleGetProductDetails(
        getProductDetailsSchema.parse(argumentsValue)
      );
    case 'createVirtualAccount':
      return handleCreateVirtualAccount(
        createVirtualAccountSchema.parse(argumentsValue),
        sessionId
      );
    case 'checkPaymentStatus':
      return handleCheckPaymentStatus(
        checkPaymentStatusSchema.parse(argumentsValue)
      );
    case 'getRecommendations':
      return handleGetRecommendations(
        getRecommendationsSchema.parse(argumentsValue)
      );
    case 'addToCart':
      return handleAddToCart(addToCartSchema.parse(argumentsValue));
  }
}

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

export async function executeAgenticChatToolForOllama(
  name: string,
  rawArguments: unknown,
  sessionId: string
): Promise<string> {
  if (!isAgenticChatToolName(name)) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    const result = await executeAgenticChatTool(name, rawArguments, sessionId);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: getToolErrorMessage(error) });
  }
}
