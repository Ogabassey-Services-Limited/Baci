import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleSearchProducts: vi.fn(),
  handleGetProductDetails: vi.fn(),
  handleCreateVirtualAccount: vi.fn(),
  handleCheckPaymentStatus: vi.fn(),
  handleGetRecommendations: vi.fn(),
  handleAddToCart: vi.fn(),
}));

vi.mock('@/ai/chat-tool-handlers', () => mocks);

import {
  createAiSdkAgenticChatTools,
  executeAgenticChatToolForOllama,
} from '@/app/api/chat/chat-tool-runtime';

describe('chat tool runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleSearchProducts.mockResolvedValue({
      products: [{ id: 'p1', name: 'iPhone 11' }],
      total: 1,
    });
    mocks.handleCreateVirtualAccount.mockResolvedValue({
      success: false,
      error: 'Unavailable',
    });
  });

  it('executes Ollama tool calls with parsed JSON arguments', async () => {
    const result = await executeAgenticChatToolForOllama(
      'searchProducts',
      '{"query":"iPhone 11","maxPrice":200000}',
      'session-1'
    );

    expect(JSON.parse(result)).toEqual({
      products: [{ id: 'p1', name: 'iPhone 11' }],
      total: 1,
    });
    expect(mocks.handleSearchProducts).toHaveBeenCalledWith({
      query: 'iPhone 11',
      maxPrice: 200000,
    });
  });

  it('returns a tool error for unknown Ollama tool names', async () => {
    const result = await executeAgenticChatToolForOllama(
      'deleteProduct',
      {},
      'session-1'
    );

    expect(JSON.parse(result)).toEqual({
      error: 'Unknown tool: deleteProduct',
    });
    expect(mocks.handleSearchProducts).not.toHaveBeenCalled();
  });

  it('returns a validation error for malformed Ollama arguments', async () => {
    const result = await executeAgenticChatToolForOllama(
      'searchProducts',
      {},
      'session-1'
    );

    expect(JSON.parse(result)).toEqual({ error: 'Invalid tool arguments' });
    expect(mocks.handleSearchProducts).not.toHaveBeenCalled();
  });

  it('passes session-scoped tools to the AI SDK Gemini path', async () => {
    const tools = createAiSdkAgenticChatTools('session-1');
    const response = await tools.createVirtualAccount.execute({
      amount: 150000,
      customerEmail: 'buyer@example.com',
      customerName: 'Buyer',
      items: [
        { productId: 'p1', name: 'iPhone 11', price: 150000, quantity: 1 },
      ],
    });

    expect(JSON.parse(response)).toEqual({
      success: false,
      error: 'Unavailable',
    });
    expect(mocks.handleCreateVirtualAccount).toHaveBeenCalledWith(
      {
        amount: 150000,
        customerEmail: 'buyer@example.com',
        customerName: 'Buyer',
        items: [
          { productId: 'p1', name: 'iPhone 11', price: 150000, quantity: 1 },
        ],
      },
      'session-1'
    );
  });
});
