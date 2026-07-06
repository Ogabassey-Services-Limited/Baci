import * as Crypto from 'expo-crypto';
import type {
  ProductEditFormData,
  ProductFulfillmentItemDraft,
} from '@/components/product/product-edit.types';
import { buildVariantFormValues } from '@/lib/product-variant-form';
import { stripHtmlTags } from '@/lib/utils';
import type { ProductWithVariants } from './products.types';

type FulfillmentSourceItem = {
  id?: string;
  imei?: string;
  serial_number?: string;
};

function createFulfillmentItemDraft(
  overrides: Partial<Omit<ProductFulfillmentItemDraft, 'id'>> = {}
): ProductFulfillmentItemDraft {
  return {
    id: Crypto.randomUUID(),
    imei: overrides.imei ?? '',
    serial_number: overrides.serial_number ?? '',
  };
}

function normalizeFulfillmentItems(
  items: FulfillmentSourceItem[] | null | undefined,
  fallbackCount = 0
): ProductFulfillmentItemDraft[] {
  const normalizedItems =
    items?.map((item) => ({
      id: item.id?.trim() || Crypto.randomUUID(),
      imei: item.imei ?? '',
      serial_number: item.serial_number ?? '',
    })) ?? [];

  if (normalizedItems.length > 0) {
    return normalizedItems;
  }

  return Array.from({ length: fallbackCount }, () =>
    createFulfillmentItemDraft()
  );
}

/**
 * Map a loaded product (with variants) into the product-edit form's initial
 * values. Extracted from `useProductEditController` so the controller stays
 * within the module-size budget and the mapping is unit-testable in isolation.
 */
export function buildProductEditFormData(
  product: ProductWithVariants
): ProductEditFormData {
  return {
    brand: product.brand ?? product.brands?.name ?? '',
    category: product.category || '',
    category_id: product.category_id || '',
    color: product.color || '',
    cost_price: product.cost_price || 0,
    description: stripHtmlTags(product.description || ''),
    fulfillment_details:
      product.fulfillment_details &&
      typeof product.fulfillment_details === 'object' &&
      'items' in product.fulfillment_details
        ? {
            items: normalizeFulfillmentItems(
              (
                product.fulfillment_details as {
                  items: FulfillmentSourceItem[];
                }
              ).items
            ),
          }
        : {
            items: normalizeFulfillmentItems([], product.stock_quantity || 0),
          },
    has_variants: product.has_variants || product.variants.length > 0,
    images: (product.images as string[]) || [],
    low_stock_threshold: product.low_stock_threshold || 3,
    manage_stock: product.manage_stock ?? true,
    name: product.name || '',
    price: product.price || 0,
    sku: product.sku || '',
    status: (product.status as 'active' | 'draft' | 'archived') || 'active',
    stock_quantity: product.stock_quantity || 0,
    variant_attributes: product.variant_attributes
      ? Object.entries(
          product.variant_attributes as Record<string, unknown>
        ).map(([key, value]) => ({
          id: Crypto.randomUUID(),
          key,
          value: String(value),
        }))
      : [],
    variants: buildVariantFormValues(product.variants, {
      costPrice: product.cost_price || 0,
      price: product.price || 0,
    }),
  };
}
