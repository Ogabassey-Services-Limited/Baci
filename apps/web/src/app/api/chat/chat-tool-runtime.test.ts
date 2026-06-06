import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleSearchProducts: vi.fn(),
  handleGetProductDetails: vi.fn(),
  handleCreateVirtualAccount: vi.fn(),
  handleCheckPaymentStatus: vi.fn(),
  handleCancelOrder: vi.fn(),
  handleGetRecommendations: vi.fn(),
  handleAddToCart: vi.fn(),
}));

vi.mock('@/ai/chat-tool-handlers', () => mocks);
vi.mock('@/ai/chat-order-cancellation', () => ({
  handleCancelOrder: mocks.handleCancelOrder,
}));

import { createAiSdkAgenticChatTools } from '@/app/api/chat/chat-tool-runtime';

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
    mocks.handleCheckPaymentStatus.mockResolvedValue({
      status: 'pending',
      orderId: 'order-1',
    });
    mocks.handleCancelOrder.mockResolvedValue({
      success: true,
      status: 'cancelled',
      orderId: 'order-1',
    });
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

  it('passes the chat session to payment status lookups', async () => {
    const tools = createAiSdkAgenticChatTools('session-1');
    const response = await tools.checkPaymentStatus.execute({
      orderId: 'order-1',
    });

    expect(JSON.parse(response)).toEqual({
      status: 'pending',
      orderId: 'order-1',
    });
    expect(mocks.handleCheckPaymentStatus).toHaveBeenCalledWith(
      { orderId: 'order-1' },
      'session-1'
    );
  });

  it('executes order cancellation through the AI SDK tools', async () => {
    const tools = createAiSdkAgenticChatTools('session-1');
    const response = await tools.cancelOrder.execute({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(JSON.parse(response)).toEqual({
      success: true,
      status: 'cancelled',
      orderId: 'order-1',
    });
    expect(mocks.handleCancelOrder).toHaveBeenCalledWith({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });
  });
});
