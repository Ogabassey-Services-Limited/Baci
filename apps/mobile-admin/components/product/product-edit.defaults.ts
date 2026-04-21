import type { ProductEditFormData } from './product-edit.types';

export function createInitialProductEditFormData(
  sku?: string
): ProductEditFormData {
  return {
    brand: '',
    category: '',
    category_id: '',
    color: '',
    cost_price: 0,
    description: '',
    fulfillment_details: { items: [] },
    has_variants: false,
    images: [],
    low_stock_threshold: 3,
    manage_stock: true,
    name: '',
    price: 0,
    sku: sku || '',
    status: 'active',
    stock_quantity: 0,
    variant_attributes: [],
    variants: [],
  };
}
