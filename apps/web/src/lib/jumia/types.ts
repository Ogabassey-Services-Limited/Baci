export interface JumiaMapping {
  id: string;
  merchant_id: string;
  product_id: string;
  variant_id: string | null;
  jumia_sku: string;
  jumia_seller_sku: string | null;
  jumia_product_id: string;
  jumia_shop_id: string;
  jumia_price: number | null;
  jumia_sale_price: number | null;
  jumia_sale_start: string | null;
  jumia_sale_end: string | null;
  is_active: boolean;
  sync_inventory: boolean;
  sync_price: boolean;
  sync_status: 'pending' | 'synced' | 'error' | 'paused';
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}
