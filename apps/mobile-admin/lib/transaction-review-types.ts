export interface TransactionReviewProductRow {
  cost_price: number | null;
  fulfillment_details: unknown;
  metadata: Record<string, unknown> | null;
  sku: string | null;
}

export interface TransactionReviewVariantRow {
  attributes: unknown;
  condition: string | null;
  cost_price: number | null;
  sku: string | null;
}

export interface TransactionReviewOrderRow {
  created_at: string;
  transaction_date?: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  fulfillment_details: unknown;
  id: string;
  order_items: Array<{
    cost_price?: number | null;
    fulfillment_data: unknown;
    id: string;
    name: string | null;
    price: number | null;
    product_id: string | null;
    product_match_status?: 'custom' | 'linked' | 'unreviewed' | null;
    product_variants?:
      | TransactionReviewVariantRow
      | TransactionReviewVariantRow[]
      | null;
    products:
      | TransactionReviewProductRow
      | TransactionReviewProductRow[]
      | null;
    quantity: number | null;
    supplier_name?: string | null;
    variant_id?: string | null;
  }> | null;
  order_number: string | null;
  payment_method: string | null;
  total: number | null;
}

export interface TransactionReviewItem {
  costPrice: number | null;
  costSource: 'order_item' | 'variant' | 'product' | null;
  id: string;
  imeiValues: string[];
  name: string;
  productId: string | null;
  productMatchStatus?: 'custom' | 'linked' | 'unreviewed' | null;
  profit: number | null;
  quantity: number;
  revenue: number;
  searchText: string;
  serialValues: string[];
  sku: string | null;
  supplierName: string;
  variantId: string | null;
}

export interface TransactionReviewOrder {
  createdAt: string;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  estimatedProfit: number;
  id: string;
  items: TransactionReviewItem[];
  missingCostCount: number;
  orderNumber: string;
  paymentMethod: string;
  searchText: string;
  total: number;
}
