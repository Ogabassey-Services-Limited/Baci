import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';
import type { SantaChatMessage } from './santa-chat-controller';
import { streamSantaReply } from './santa-chat-controller';

function makeStreamingResponse(
  content: string,
  headers: HeadersInit = {}
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });

  return new Response(body, { headers });
}

function createMessageState() {
  let messages: SantaChatMessage[] = [];
  const setMessages: Dispatch<SetStateAction<SantaChatMessage[]>> = (next) => {
    messages = typeof next === 'function' ? next(messages) : next;
  };

  return {
    get messages() {
      return messages;
    },
    setMessages,
  };
}

function createStreamOptions(
  setMessages: Dispatch<SetStateAction<SantaChatMessage[]>>,
  onCartAction: (productName: string, price: number) => Promise<void>,
  onMerchantSlug: (merchantSlug: string) => void
) {
  return {
    updatedMessages: [
      { id: 'user-1', role: 'user' as const, content: 'Find a phone' },
    ],
    abortControllerRef: { current: null },
    processedActionsRef: { current: new Set<string>() },
    setMessages,
    onCartAction,
    onMerchantSlug,
  };
}

describe('streamSantaReply', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adopts the resolved tenant and processes streamed cart actions', async () => {
    const state = createMessageState();
    const onCartAction = vi.fn().mockResolvedValue(undefined);
    const onMerchantSlug = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeStreamingResponse(
            'ACTION:ADD_TO_CART|PRODUCT:Phone|PRICE:450000',
            { [SANTA_MERCHANT_SLUG_HEADER]: 'winter-store' }
          )
        )
    );

    await streamSantaReply(
      createStreamOptions(state.setMessages, onCartAction, onMerchantSlug)
    );

    expect(onMerchantSlug).toHaveBeenCalledWith('winter-store');
    expect(state.messages[0]?.content).toBe(
      'ACTION:ADD_TO_CART|PRODUCT:Phone|PRICE:450000'
    );
    expect(onCartAction).toHaveBeenCalledWith('Phone', 450000);
  });

  it('fails before mutating messages when Santa returns a non-success response', async () => {
    const state = createMessageState();
    const onCartAction = vi.fn().mockResolvedValue(undefined);
    const onMerchantSlug = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(
      streamSantaReply(
        createStreamOptions(state.setMessages, onCartAction, onMerchantSlug)
      )
    ).rejects.toThrow('Failed to get response from Santa');

    expect(state.messages).toEqual([]);
    expect(onCartAction).not.toHaveBeenCalled();
    expect(onMerchantSlug).not.toHaveBeenCalled();
  });
});
