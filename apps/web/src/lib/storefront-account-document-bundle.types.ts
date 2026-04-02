type JsonRecord = Record<string, unknown>;
type MoneyValue = number | string | null;
export type RateValue = number | string | null;
type AddressValue = JsonRecord | string | null;

export interface StorefrontAccountDocumentMerchantRow {
  business_name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  rider_phone_number?: string | null;
  business_address: string | null;
  cac_rc_number: string | null;
  tax_identification_number: string | null;
  legal_entity_name: string | null;
  brand_colors: JsonRecord | null;
  vat_registration_status: string | null;
  vat_rate: number | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  social_media: JsonRecord | null;
  pages: JsonRecord | null;
  registered_address: JsonRecord | null;
}

export interface StorefrontAccountDocumentCustomerRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface StorefrontAccountDocumentOrderRow {
  id: string;
  order_number: string;
  external_source?: string | null;
  import_job_id?: string | null;
  created_at: string;
  updated_at: string | null;
  payment_status: string | null;
  shipping_status: string | null;
  currency: string | null;
  total: MoneyValue;
  subtotal: MoneyValue;
  shipping_fee: MoneyValue;
  tax_amount: MoneyValue;
  discount_amount: MoneyValue;
  amount_paid: MoneyValue;
  shipping_address: AddressValue;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  is_credit_order: boolean | null;
  tracking_number: string | null;
  shipping_provider: string | null;
  notes: string | null;
  invoice_type_code: string | null;
  invoice_issue_date: string | null;
  tax_point_date: string | null;
  payment_due_date: string | null;
  buyer_reference: string | null;
  purchase_order_reference: string | null;
  tax_exclusive_amount: MoneyValue;
  tax_inclusive_amount: MoneyValue;
  invoice_note: string | null;
  firs_irn: string | null;
  firs_csid: string | null;
  firs_qr_code: string | null;
  payment_terms: string | null;
}

export interface StorefrontAccountDocumentItemRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  variant_name: string | null;
  name: string;
  quantity: number | null;
  price: MoneyValue;
}

export interface StorefrontAccountDocumentTransactionRow {
  id: string | null;
  amount: MoneyValue;
  created_at: string;
  description: string | null;
  metadata: JsonRecord | null;
}

export interface StorefrontAccountDocumentPaymentAccountRow {
  account_number: string;
  bank_name: string | null;
  account_name: string | null;
}

export interface StorefrontAccountDocumentTaxSubtotalRow {
  vat_category_code: string;
  vat_rate: RateValue;
  taxable_amount: MoneyValue;
  tax_amount: MoneyValue;
  exemption_reason: string | null;
}
