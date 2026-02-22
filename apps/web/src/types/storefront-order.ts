import type {
  OrderSource,
  PaymentStatus,
  ShippingStatus,
} from '@baci/shared/types';

/**
 * Represents an item in a storefront order.
 */
export interface StorefrontOrderItem {
  id: string;
  product_id: string;
  /**
   * Product name.
   * Note: API returns `product_name` (aliased from `name`) or `name` depending on the path.
   * Component logic should prioritize `product_name`.
   */
  product_name?: string;
  name?: string;
  quantity: number;
  price: number;
  /**
   * Product images array.
   * API returns `product_images` (string[]).
   */
  product_images?: string[];
  /**
   * Single product image URL.
   * Some components expect `product_image` or `image`.
   * This field is typically derived from `product_images[0]` on the client or returned by specific RPCs.
   */
  product_image?: string;
  image?: string;
}

/**
 * Represents a storefront order details response.
 * Used by components like `OgabasseyV2OrderDetails`.
 */
export interface StorefrontOrder {
  id: string;
  order_number: string;
  short_id?: string;
  subtotal: number;
  shipping_cost: number;
  shipping_fee?: number;
  total: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  /**
   * Shipping address can be a JSON object (from DB) or a formatted string.
   * Components must handle both cases.
   */
  shipping_address: string | Record<string, unknown> | null;
  shipping_provider?: string;
  payment_status: PaymentStatus;
  shipping_status: ShippingStatus;
  payment_method: string | null;
  payment_provider?: string;
  merchant_id: string;
  tracking_token?: string | null;
  tracking_number?: string;
  tracking_url?: string;
  items: StorefrontOrderItem[];
  created_at?: string;
  updated_at?: string;
  source?: OrderSource | null;
}
