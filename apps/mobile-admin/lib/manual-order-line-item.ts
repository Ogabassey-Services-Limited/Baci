import { getProductPickerRowTitle } from '@/lib/order-product-picker';
import type { SelectableProductPickerItem } from '@/lib/product-picker-variant-rows';

export interface ManualOrderLineItem {
  condition?: string;
  id: string;
  image_url?: string;
  name: string;
  price: number;
  product_id: string | null;
  quantity: number;
  variant_id: string | null;
  variant_name: string | null;
}

export type SelectableManualOrderProduct = Pick<
  SelectableProductPickerItem,
  | 'condition'
  | 'has_variants'
  | 'id'
  | 'images'
  | 'name'
  | 'parent_product_id'
  | 'price'
  | 'sku'
  | 'variant_attributes'
>;

export function buildManualOrderLineItem(args: {
  fallbackImageUrl?: string | null;
  parentProductName?: string | null;
  product: SelectableManualOrderProduct;
}): ManualOrderLineItem {
  const parentProductId = args.product.parent_product_id ?? args.product.id;
  const variantId = args.product.parent_product_id ? args.product.id : null;
  const normalizedParentName = args.parentProductName?.trim();

  return {
    id: `${parentProductId}::${variantId ?? 'base'}`,
    product_id: parentProductId,
    name: variantId
      ? normalizedParentName || args.product.name
      : args.product.name,
    quantity: 1,
    price: args.product.price,
    condition: args.product.condition ?? undefined,
    image_url: args.product.images?.[0] ?? args.fallbackImageUrl ?? undefined,
    variant_id: variantId,
    variant_name: variantId
      ? getProductPickerRowTitle(args.product, normalizedParentName)
      : null,
  };
}
