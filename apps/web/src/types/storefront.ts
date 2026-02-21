export interface StorefrontOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  // API returns name/product_name. Component checks both.
  name?: string;
  product_name?: string;
  // API returns product_images string[]. Component checks product_image or image (likely singular string)
  image?: string;
  product_image?: string;
  product_images?: string[];
}

export interface StorefrontOrder {
  id: string;
  merchant_id: string;
  order_number: string;
  short_id?: string;

  // Financials
  subtotal: number;
  total: number;
  shipping_fee: number;
  shipping_cost?: number; // Alias often used in frontend
  tax_amount?: number;
  discount_amount?: number;
  currency?: string;

  // Customer
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?:
    | string
    | {
        address?: string;
        city?: string;
        state?: string;
        [key: string]: unknown;
      };

  // Status
  payment_status: string;
  shipping_status: string;
  status?: string; // Sometimes used as generic status

  // Payment & Delivery Details
  payment_method?: string;
  payment_provider?: string; // Frontend specific
  paymentMethod?: string; // Frontend legacy

  shipping_provider?: string;
  tracking_number?: string;
  tracking_url?: string;
  tracking_token?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;

  // Items
  items: StorefrontOrderItem[];
}
