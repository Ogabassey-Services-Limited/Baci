import type { EditableProductVariant } from '@/lib/product-variant-form';

export interface ProductVariantAttributeDraft {
  key: string;
  value: string;
}

export interface ProductFulfillmentItemDraft {
  imei: string;
  serial_number: string;
}

export interface ProductEditFormData {
  brand: string;
  category: string;
  category_id: string;
  color: string;
  cost_price: number;
  description: string;
  fulfillment_details: {
    items: ProductFulfillmentItemDraft[];
  };
  has_variants: boolean;
  images: string[];
  low_stock_threshold: number;
  manage_stock: boolean;
  name: string;
  price: number;
  sku: string;
  status: 'active' | 'draft' | 'archived';
  stock_quantity: number;
  variant_attributes: ProductVariantAttributeDraft[];
  variants: EditableProductVariant[];
}
