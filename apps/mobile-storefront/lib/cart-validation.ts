import type { CartItem } from '@/stores/cart-store';

export interface ValidCartStore {
  items: CartItem[];
  itemCount: () => number;
  subtotal: () => number;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  toggleAssurance: (itemId: string) => void;
}

export function isValidCartStore(store: unknown): store is ValidCartStore {
  if (!store || typeof store !== 'object') {
    return false;
  }

  const candidate = store as Partial<ValidCartStore>;
  if (!Array.isArray(candidate.items)) {
    return false;
  }

  const hasValidItemShape =
    candidate.items.length === 0 ||
    candidate.items.every((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const cartItem = item as Partial<CartItem>;
      return (
        typeof cartItem.id === 'string' && typeof cartItem.quantity === 'number'
      );
    });

  return (
    hasValidItemShape &&
    typeof candidate.itemCount === 'function' &&
    typeof candidate.subtotal === 'function' &&
    typeof candidate.updateQuantity === 'function' &&
    typeof candidate.removeItem === 'function' &&
    typeof candidate.clearCart === 'function' &&
    typeof candidate.toggleAssurance === 'function'
  );
}
