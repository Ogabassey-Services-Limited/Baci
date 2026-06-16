import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import type { AdminProductStatus } from '@/lib/product-search';

export type ProductStatus = AdminProductStatus;

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  stock: number;
  sku: string | null;
  slug: string;
  images: string[];
  status: ProductStatus;
  category: string | null;
  category_id: string | null;
  brand: string | null;
  brand_id: string | null;
  fulfillment_details: {
    items?: Array<{ imei: string; serial_number: string }>;
    [key: string]: unknown;
  } | null;
  color: string | null;
  condition: string | null;
  variant_attributes: Record<string, unknown> | null;
  has_variants: boolean;
  manage_stock: boolean;
  low_stock_threshold: number | null;
  variant_model: 'legacy' | 'sku_matrix' | null;
  migration_status: 'pending' | 'needs_review' | 'migrated' | null;
  default_variant_id: string | null;
  available_conditions: string[] | null;
  min_variant_price: number | null;
  max_variant_price: number | null;
  inventory_tracking_policy:
    | 'off'
    | 'serialized_strict'
    | 'serialized_then_unlimited'
    | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryStats {
  inventoryValue: number;
  inventoryCost: number;
  totalStock: number;
  totalProducts: number;
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
}

export interface ProductsPage {
  products: Product[];
  nextCursor: number | null;
  totalCount: number;
}

export interface PersistedProductVariantInput {
  attributes: Record<string, string>;
  condition?: string | null;
  cost_price: number | null;
  id?: string;
  images: string[];
  primary_image: string | null;
  price_override: number;
  sku: string | null;
  stock_quantity: number;
}

export type ProductWithVariants = Product & {
  categories?: { name: string };
  brands?: { name: string };
  variants: AdminProductVariant[];
};
