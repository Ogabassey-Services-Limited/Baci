import type { CartItem } from '@/stores/cart-store';

export interface NegotiationItemInfoViewModel {
  brand?: string;
  condition?: string;
  currentPrice: number;
  id?: string;
  name: string;
  productSlug?: string;
  variantAttributes?: Record<string, string>;
  variantId?: string;
  variantName?: string;
}

export interface UseNegotiationModalControllerParams {
  currentPrice: number;
  isNegotiable?: boolean;
  itemInfo: NegotiationItemInfoViewModel | null;
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
