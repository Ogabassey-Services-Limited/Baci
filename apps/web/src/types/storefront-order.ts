import type { PaymentStatus, ShippingStatus } from '@baci/shared/types';

export interface StorefrontOrderItem {
  id: string;
  product_id: string;
  product_slug?: string;
  category?: string;
  category_slug?: string;
  categories?: { name?: string; slug?: string } | null;
  variant_id?: string;
  variant_name?: string;
  name: string;
  product_name?: string;
  quantity: number;
  price: number;
  /**
   * API returns `product_images` array in some branches.
   * Components might expect `product_image` or `image`.
   */
  product_images?: string[];
  product_image?: string;
  image?: string;
}

export interface StorefrontVirtualAccount {
  account_number: string;
  bank_name: string;
  account_name: string;
}

export interface StorefrontTransaction {
  id?: string;
  amount: number;
  created_at: string;
  description: string | null;
  metadata: { payment_method?: string } | null;
}

export type StorefrontDocumentKind = 'invoice' | 'receipt';

export interface StorefrontShippingAddress {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: unknown;
}

export interface StorefrontOrder {
  id: string;
  order_number: string;
  created_at: string;
  updated_at?: string;

  /**
   * Status field used in realtime updates
   */
  status?: string;

  shipping_status: ShippingStatus | string;
  payment_status: PaymentStatus | string;

  tracking_number?: string;
  tracking_url?: string;

  subtotal?: number;
  total: number;

  shipping_cost?: number;
  shipping_fee?: number;

  shipping_provider?: string;

  /**
   * Shipping address might be a formatted string or a structured object (JSONB).
   */
  shipping_address?: string | StorefrontShippingAddress | null;

  /**
   * The payment method used (e.g. 'paystack', 'bank_transfer').
   * API returns snake_case `payment_method`.
   */
  payment_method?: string;

  /**
   * @deprecated Component uses this but API returns `payment_method`.
   */
  payment_provider?: string;

  /**
   * @deprecated Component uses this but API returns `payment_method`.
   */
  paymentMethod?: string;

  currency?: string;
  amount_paid?: number;
  tax_amount?: number;
  discount_amount?: number;
  balance?: number;
  current_document_kind?: StorefrontDocumentKind;
  receipt_eligible?: boolean;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  notes?: string | null;
  virtual_account?: StorefrontVirtualAccount | null;
  transactions?: StorefrontTransaction[];

  items: StorefrontOrderItem[];
}
