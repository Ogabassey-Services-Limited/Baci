import type { SupabaseClient } from '@supabase/supabase-js';

export type JumiaImportMappingRow = {
  merchant_id: string;
  product_id: string;
  variant_id: string | null;
  jumia_sku: string;
  jumia_seller_sku: string;
  jumia_shop_id: string;
  marketplace_key: string;
  jumia_price: number;
  jumia_product_id: string | null;
  is_active: boolean;
  sync_status: string;
  last_synced_at: string;
};

export type JumiaImportProductRow = {
  merchant_id: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  stock_level: number;
  is_active: boolean;
  images: string[];
};

type UpsertJumiaImportMappingsArgs = {
  supabase: SupabaseClient;
  rows: JumiaImportMappingRow[];
};

export function upsertJumiaImportMappings({
  supabase,
  rows,
}: UpsertJumiaImportMappingsArgs) {
  return supabase.from('jumia_product_mappings').upsert(rows, {
    onConflict: 'product_id,variant_id,jumia_shop_id,marketplace_key',
  });
}
