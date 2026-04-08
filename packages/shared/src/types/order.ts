/**
 * Shared Order Types
 * Used by both web dashboard and mobile admin app
 */

export type ShippingStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentStatus =
  | 'paid'
  | 'unpaid'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'partially_paid'
  | 'bnpl_approved'
  | 'bnpl_pending';

export type OrderSource =
  | 'online_store'
  | 'storefront'
  | 'whatsapp'
  | 'instagram'
  | 'web'
  | 'manual'
  | 'staff_entry'
  | 'facebook'
  | 'tiktok'
  | 'jumia'
  | 'jiji'
  | 'konga'
  | 'physical'
  | string;

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  price: number;
  total?: number;
  image_url?: string;
}

export interface Order {
  id: string;
  order_number: string;
  merchant_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_status: ShippingStatus;
  payment_status: PaymentStatus;
  total: number;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  currency: string;
  source: OrderSource | null;
  payment_method: string | null;
  notes: string | null;
  is_credit_order?: boolean;
  shipping_address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: OrderItem[];
}
