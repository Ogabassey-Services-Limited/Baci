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

  describe('bugfix: concurrent duplicate side-effecting tool calls', () => {
    it('runs createVirtualAccount only once when duplicate parallel calls arrive in one AI-SDK step', async () => {
      // The AI SDK runs a step's tool calls concurrently; without dedupe each
      // duplicate would insert its own chat_orders row.
      const tools = createAiSdkAgenticChatTools('session-1');
      const params = {
        amount: 150000,
        customerEmail: 'buyer@example.com',
        customerName: 'Buyer',
        items: [
          { productId: 'p1', name: 'iPhone 11', price: 150000, quantity: 1 },
        ],
      };

      const [first, second] = await Promise.all([
        tools.createVirtualAccount.execute({ ...params }),
        tools.createVirtualAccount.execute({ ...params }),
      ]);

      expect(mocks.handleCreateVirtualAccount).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('cancels an order only once for duplicate parallel cancels of the same order', async () => {
      const tools = createAiSdkAgenticChatTools('session-1');
      const params = {
        orderNumber: '#00001234',
        customerEmail: 'buyer@example.com',
      };

      await Promise.all([
        tools.cancelOrder.execute({ ...params }),
        tools.cancelOrder.execute({ ...params }),
      ]);

      expect(mocks.handleCancelOrder).toHaveBeenCalledTimes(1);
    });

    it('still cancels each DISTINCT order when different cancels arrive in one turn', async () => {
      const tools = createAiSdkAgenticChatTools('session-1');

      await Promise.all([
        tools.cancelOrder.execute({
          orderNumber: '#0001',
          customerEmail: 'buyer@example.com',
        }),
        tools.cancelOrder.execute({
          orderNumber: '#0002',
          customerEmail: 'buyer@example.com',
        }),
      ]);

      expect(mocks.handleCancelOrder).toHaveBeenCalledTimes(2);
    });

    it('scopes dedupe per request — a fresh tools instance runs the side effect again', async () => {
      const params = {
        orderNumber: '#00001234',
        customerEmail: 'buyer@example.com',
      };

      await createAiSdkAgenticChatTools('session-1').cancelOrder.execute({
        ...params,
      });
      await createAiSdkAgenticChatTools('session-1').cancelOrder.execute({
        ...params,
      });

      expect(mocks.handleCancelOrder).toHaveBeenCalledTimes(2);
    });
  });
});
