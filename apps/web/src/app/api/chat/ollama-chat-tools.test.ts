import { describe, expect, it } from 'vitest';
import { ollamaAgenticChatTools } from '@/app/api/chat/ollama-chat-tools';

describe('ollama chat tools', () => {
  it('exposes the same six commerce capabilities as the Gemini path', () => {
    expect(ollamaAgenticChatTools.map((tool) => tool.function.name)).toEqual([
      'searchProducts',
      'getProductDetails',
      'createVirtualAccount',
      'checkPaymentStatus',
      'getRecommendations',
      'addToCart',
    ]);
  });

  it('marks product search and checkout tools with required parameters', () => {
    const searchTool = ollamaAgenticChatTools.find(
      (tool) => tool.function.name === 'searchProducts'
    );
    const accountTool = ollamaAgenticChatTools.find(
      (tool) => tool.function.name === 'createVirtualAccount'
    );

    expect(searchTool?.function.parameters).toMatchObject({
      required: ['query'],
      properties: {
        query: { type: 'string' },
        maxPrice: { type: 'number' },
      },
    });
    expect(accountTool?.function.parameters).toMatchObject({
      required: ['amount', 'customerEmail', 'customerName', 'items'],
      properties: {
        items: {
          type: 'array',
          items: {
            required: ['productId', 'name', 'price', 'quantity'],
          },
        },
      },
    });
  });
});
