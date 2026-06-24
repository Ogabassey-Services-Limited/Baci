import type { CartItem } from '@/hooks/cart';
import { DEFAULT_ASSURANCE_RATE } from '@/lib/checkout/constants';

export interface CartTotalNegotiationPlan {
  /** Lines whose individual negotiation must be cleared before a cart-wide deal. */
  itemsToReset: CartItem[];
  /** Price the bulk negotiation should open at. */
  currentPrice: number;
  /** True when individual offers exist and must be confirmed/cleared first. */
  requiresReset: boolean;
}

/** Lines carrying an accepted individual negotiation. */
export function getNegotiatedCartItems(cart: CartItem[]): CartItem[] {
  return cart.filter(
    (item) =>
      item.negotiationStatus === 'accepted' || item.negotiatedPrice != null
  );
}

/** Sum of catalog (pre-negotiation) line prices plus assurance. */
export function computeBaseCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => {
    const lineBase = item.price * item.quantity;
    const assurance = item.hasAssurance
      ? lineBase * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE)
      : 0;
    return sum + lineBase + assurance;
  }, 0);
}

/**
 * Decides how to open a whole-cart negotiation. A cart-wide deal replaces any
 * individual line offers, so when offers exist the plan requires clearing them
 * and negotiating from the base (pre-negotiation) total — otherwise the new
 * total would distribute over already-discounted lines and stack stale offers
 * (tripping the server-side floor at checkout). With no offers, it opens at the
 * supplied display total.
 */
export function planCartTotalNegotiation(
  cart: CartItem[],
  fallbackTotal: number
): CartTotalNegotiationPlan {
  const itemsToReset = getNegotiatedCartItems(cart);
  if (itemsToReset.length > 0) {
    return {
      itemsToReset,
      currentPrice: computeBaseCartTotal(cart),
      requiresReset: true,
    };
  }

  return { itemsToReset: [], currentPrice: fallbackTotal, requiresReset: false };
}

export interface RunCartTotalNegotiationArgs {
  cart: CartItem[];
  fallbackTotal: number;
  clearNegotiatedPrice?: (cartItemId: string) => void;
  confirmReset: () => boolean;
  openBulk: (currentPrice: number) => void;
}

/**
 * Shared entry point for "negotiate the whole cart" across every cart surface
 * (page, drawer). When individual offers exist it clears them (after the caller
 * confirms) and opens from the base total; otherwise it opens at the display
 * total. Keeps all cart UIs from stacking a cart-wide deal on stale line offers.
 */
export function runCartTotalNegotiation({
  cart,
  fallbackTotal,
  clearNegotiatedPrice,
  confirmReset,
  openBulk,
}: RunCartTotalNegotiationArgs): void {
  const plan = planCartTotalNegotiation(cart, fallbackTotal);

  if (plan.requiresReset) {
    // Without the clear action we cannot reset individual offers, so bail
    // rather than stack a cart-wide deal on stale per-line prices.
    if (!clearNegotiatedPrice || !confirmReset()) {
      return;
    }
    for (const item of plan.itemsToReset) {
      clearNegotiatedPrice(item.cartItemId);
    }
  }

  openBulk(plan.currentPrice);
}
