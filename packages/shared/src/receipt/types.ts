export interface ReceiptMerchant {
  business_name: string | null;
  logo_url: string | null;
  email: string;
  phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  business_address: string | null;
  cac_rc_number: string | null;
  tax_identification_number: string | null;
  legal_entity_name: string | null;
  brand_colors?: { primary: string; background: string; accent: string };
  vat_registration_status: string | null;
  vat_rate: number | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  social_media?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
  } | null;
  pages?: {
    terms?: string;
  } | null;
}

export interface ReceiptOrder {
  order_number: string;
  created_at: string;
  currency: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  payment_method: string | null;
  is_credit_order?: boolean;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  virtual_account?: {
    account_number: string;
    bank_name: string;
    account_name: string;
  } | null;
  fulfillment_details?: {
    imei?: string | null;
    serialNumber?: string | null;
    serial_number?: string | null;
  } | null;
  items: Array<{
    product_name: string;
    name?: string;
    variant_name?: string;
    quantity: number;
    price: number;
  }>;
  transactions?: Array<{
    amount: number;
    created_at: string;
    description: string | null;
    metadata: { payment_method?: string } | null;
  }>;
}

export interface ReceiptOptions {
  qrCodeDataUri?: string;
  storeUrl?: string;
  paymentLink?: string;
  svgXml?: string;
}
