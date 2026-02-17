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
  productName: string;
  price: number;
}

/**
 * Parse ACTION:ADD_TO_CART|PRODUCT:xxx|PRICE:xxx from Santa's response.
 * Returns parsed product name and numeric price, or null if no action found.
 */
export function parseSantaAction(content: string): SantaAction | null {
  const actionMatch = content.match(
    /ACTION:ADD_TO_CART\|PRODUCT:([^|]+)\|PRICE:(\d+(?:,\d+)*)/
  );
  if (!actionMatch) return null;

  return {
    type: 'ADD_TO_CART',
    productName: actionMatch[1].trim(),
    price: Number.parseInt(actionMatch[2].replace(/,/g, ''), 10),
  };
}
