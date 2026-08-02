import type { Dispatch, SetStateAction } from 'react';
import type { Product } from '@/lib/products';
import { readSantaMerchantSlug } from './read-santa-merchant-slug';
import { parseSantaActions } from './types';

export interface SantaChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

interface StreamSantaReplyOptions {
  updatedMessages: SantaChatMessage[];
  abortControllerRef: { current: AbortController | null };
  processedActionsRef: { current: Set<string> };
  setMessages: Dispatch<SetStateAction<SantaChatMessage[]>>;
  onCartAction: (productName: string, price: number) => Promise<void>;
  onMerchantSlug: (merchantSlug: string) => void;
}

export async function streamSantaReply({
  updatedMessages,
  abortControllerRef,
  processedActionsRef,
  setMessages,
  onCartAction,
  onMerchantSlug,
}: StreamSantaReplyOptions): Promise<void> {
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;

  const response = await fetch('/api/chat/santa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      messages: updatedMessages.map((message) => ({
        role: message.role,
        content: message.content,
        imageUrl: message.imageUrl,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get response from Santa');
  }

  const merchantSlug = readSantaMerchantSlug(response);
  if (merchantSlug) {
    onMerchantSlug(merchantSlug);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let assistantContent = '';
  const assistantId = `assistant-${Date.now()}`;

  setMessages((previousMessages) => [
    ...previousMessages,
    { id: assistantId, role: 'assistant', content: '' },
  ]);

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    assistantContent += chunk;
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === assistantId
          ? { ...message, content: assistantContent }
          : message
      )
    );
  }

  const actions = parseSantaActions(assistantContent);
  if (actions.length === 0 || processedActionsRef.current.has(assistantId)) {
    return;
  }

  processedActionsRef.current.add(assistantId);
  const actionResults = await Promise.allSettled(
    actions.map((action) => onCartAction(action.productName, action.price))
  );

  actionResults.forEach((result, index) => {
    if (result.status !== 'rejected') return;
    const action = actions[index];
    console.error('[Santa Cart] Action failed:', {
      productName: action?.productName,
      price: action?.price,
      reason: result.reason,
    });
  });
}

interface AddSantaProductToCartOptions {
  productName: string;
  negotiatedPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  setMerchantSlug: (merchantSlug: string) => void;
  applyNegotiatedPrice?: (cartItemId: string, newPrice: number) => void;
  showNotification: (message: string) => void;
}

export async function addSantaProductToCart({
  productName,
  negotiatedPrice,
  addToCart,
  setMerchantSlug,
  applyNegotiatedPrice,
  showNotification,
}: AddSantaProductToCartOptions): Promise<void> {
  try {
    const response = await fetch('/api/chat/santa/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productName }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('[Santa Cart] Failed to fetch product');
      return;
    }

    const resolvedMerchantSlug = readSantaMerchantSlug(response);
    if (resolvedMerchantSlug) {
      setMerchantSlug(resolvedMerchantSlug);
    }

    const { product } = (await response.json()) as {
      product: Product | null;
    };

    if (!product) {
      console.error('[Santa Cart] Product not found:', productName);
      showNotification(`Could not find "${productName}" in catalog`);
      return;
    }

    addToCart(product, 1);

    if (applyNegotiatedPrice && negotiatedPrice < product.price) {
      applyNegotiatedPrice(product.id, negotiatedPrice);
    }

    showNotification(`${product.name} added to cart!`);
  } catch (error) {
    console.error('[Santa Cart] Error adding to cart:', error);
  }
}
