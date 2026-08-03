import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';

const chatMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  parseSantaActions: vi.fn(),
  setMerchantSlug: vi.fn(),
  setIsCartOpen: vi.fn(),
  stripSantaActions: vi.fn((content: string) => content),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: chatMocks.addToCart,
    setMerchantSlug: chatMocks.setMerchantSlug,
    setIsCartOpen: chatMocks.setIsCartOpen,
  })),
}));

vi.mock('@/components/storefront/santa-chat/types', () => ({
  parseSantaActions: chatMocks.parseSantaActions,
  stripSantaActions: chatMocks.stripSantaActions,
}));

import { useOgabasseyChat } from './use-ogabassey-chat';

function makeStreamingResponse(text: string, merchantSlug?: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return {
    ok: true,
    body: stream,
    headers: new Headers(
      merchantSlug ? { [SANTA_MERCHANT_SLUG_HEADER]: merchantSlug } : undefined
    ),
  };
}

describe('useOgabasseyChat resolved Santa tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMocks.parseSantaActions.mockReturnValue([]);
    chatMocks.stripSantaActions.mockImplementation((content: string) => content);
    window.localStorage.clear();
    global.fetch = vi.fn();
  });

  it('attributes selected Santa actions to the resolved tenant before adding', async () => {
    chatMocks.parseSantaActions.mockReturnValueOnce([
      { type: 'ADD_TO_CART', productName: 'iPhone 15', price: 600000 },
      { type: 'ADD_TO_CART', productName: 'Pixel 9', price: 500000 },
    ]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('raw Santa directives', 'winter-store')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: true }));

    await act(async () => {
      await result.current.handleSend('I want two phones');
    });
    await act(async () => {
      result.current.handleAddSantaWishToCart(1, 1);
    });

    expect(chatMocks.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'winter-store',
        name: 'Pixel 9',
        price: 500000,
      }),
      1
    );
    expect(chatMocks.setMerchantSlug).toHaveBeenCalledWith('winter-store');
    expect(chatMocks.setMerchantSlug.mock.invocationCallOrder[0]).toBeLessThan(
      chatMocks.addToCart.mock.invocationCallOrder[0]
    );
    expect(result.current.messages[1]?.santaActions?.[1]?.added).toBe(true);
  });

  it('fails closed when the Santa response has no tenant header', async () => {
    chatMocks.parseSantaActions.mockReturnValueOnce([
      { type: 'ADD_TO_CART', productName: 'iPhone 15', price: 600000 },
    ]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('raw Santa directive')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: true }));

    await act(async () => {
      await result.current.handleSend('I want a phone');
    });
    act(() => result.current.handleAddSantaWishToCart(1));

    expect(chatMocks.setMerchantSlug).not.toHaveBeenCalled();
    expect(chatMocks.addToCart).not.toHaveBeenCalled();
  });

  it('rejects a Santa action resolved for a different storefront', async () => {
    chatMocks.parseSantaActions.mockReturnValueOnce([
      { type: 'ADD_TO_CART', productName: 'iPhone 15', price: 600000 },
    ]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('raw Santa directive', 'winter-store')
    );

    const { result } = renderHook(() =>
      useOgabasseyChat({
        isSanta: true,
        storefrontMerchantSlug: 'ogabassey',
      })
    );

    await act(async () => {
      await result.current.handleSend('I want a phone');
    });
    act(() => result.current.handleAddSantaWishToCart(1));

    expect(chatMocks.setMerchantSlug).not.toHaveBeenCalled();
    expect(chatMocks.addToCart).not.toHaveBeenCalled();
  });
});
