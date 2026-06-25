import type { CartItem } from '@/stores/cart-store';

export interface NegotiationItemInfo {
  currentPrice: number;
  id?: string;
  name: string;
}

export interface UseNegotiationModalControllerParams {
  currentPrice: number;
  isNegotiable?: boolean;
  itemInfo: NegotiationItemInfo | null;
  merchantId: string | null;
  onAcceptedPrice?: (price: number) => void;
  successMessageFormatter: (price: number) => string;
  type: 'single' | 'total';
  visible: boolean;
  /** Live cart lines to snapshot for whole-cart ("total") offers. */
  cartItems?: CartItem[];
  /** Phone to prefill the follow-up field with for signed-in customers. */
  prefillPhone?: string;
}
