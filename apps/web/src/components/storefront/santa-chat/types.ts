/**
 * Santa Chat Type Definitions
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  audioUrl?: string;
  action?: string;
}

export interface SantaAction {
  type: 'ADD_TO_CART';
  product: string;
  price: string;
}

/**
 * Parse the ACTION:ADD_TO_CART|PRODUCT:xxx|PRICE:xxx format
 */
export function parseCartAction(text: string): SantaAction | null {
  if (!text.includes('ACTION:ADD_TO_CART')) {
    return null;
  }

  const parts = text.split('|');
  const productPart = parts.find((p) => p.startsWith('PRODUCT:'));
  const pricePart = parts.find((p) => p.startsWith('PRICE:'));

  if (productPart && pricePart) {
    return {
      type: 'ADD_TO_CART',
      product: productPart.replace('PRODUCT:', '').trim(),
      price: pricePart.replace('PRICE:', '').trim(),
    };
  }

  return null;
}
