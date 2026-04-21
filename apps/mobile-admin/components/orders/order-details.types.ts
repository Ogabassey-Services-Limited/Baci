import type { PaymentStatus, ShippingStatus } from '@/hooks/useOrders';

export interface OrderDetailsItem {
  condition?: string;
  id: string;
  image_url?: string;
  name: string;
  price: number;
  product_name?: string;
  product_id?: string | null;
  quantity: number;
  variant_name?: string;
}

export interface OrderDetailsRecord {
  amount_paid: number;
  balance: number;
  created_at: string;
  currency?: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  discount_amount: number;
  fulfillment_details?: { imei?: string; serialNumber?: string } | null;
  id: string;
  is_credit_order?: boolean | null;
  items?: OrderDetailsItem[];
  order_number: string;
  payment_method?: string | null;
  payment_status: PaymentStatus;
  recorded_by_name?: string | null;
  self_fulfillment_data?: {
    carrierName?: string | null;
    dispatchPhone?: string | null;
  } | null;
  shipping_address:
    | {
        address?: string | null;
        city?: string | null;
        state?: string | null;
      }
    | string
    | null;
  shipping_fee?: number | null;
  shipping_provider?: string | null;
  shipping_status: ShippingStatus;
  source?: string | null;
  staff_terminal?: {
    account_name: string;
    account_number: string;
    bank_name: string;
  } | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total: number;
  updated_at: string;
  virtual_account?: {
    account_name: string;
    account_number: string;
    bank_name: string;
  } | null;
}

export interface OrderSourceInfo {
  color: string;
  label: string;
  name: string;
}
