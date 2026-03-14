import {
  formatVariantAxisLabel,
  normalizeStorefrontProductVariants,
  type StorefrontVariantRecord,
} from '@baci/shared';
import { withSupabaseRetry } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { ProductVariant } from '@/types/product';

const log = createLogger('StorefrontProductVariants');

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function normalizeVariantRecordAttributes(
  value: unknown
): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const normalizedAttributes: Record<string, string> = {};

  for (const [key, attributeValue] of Object.entries(value)) {
    if (typeof attributeValue === 'string') {
      normalizedAttributes[key] = attributeValue;
    }
  }

  return normalizedAttributes;
}

function toStorefrontVariantRecord(
  value: unknown
): StorefrontVariantRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    return null;
  }

  return {
    id: record.id,
    attributes: normalizeVariantRecordAttributes(record.attributes),
    images: Array.isArray(record.images)
      ? record.images.filter(
          (image): image is string => typeof image === 'string'
        )
      : null,
    merchant_id:
      typeof record.merchant_id === 'string' ? record.merchant_id : null,
    price_override: normalizeOptionalNumber(record.price_override),
    primary_image:
      typeof record.primary_image === 'string' ? record.primary_image : null,
    product_id:
      typeof record.product_id === 'string' ? record.product_id : null,
    sku: typeof record.sku === 'string' ? record.sku : null,
    stock_quantity:
      typeof record.stock_quantity === 'number' &&
      Number.isFinite(record.stock_quantity)
        ? record.stock_quantity
        : null,
  };
}

function buildVariantName(
  attributes: Record<string, string>,
  sku?: string | null
) {
  const parts = Object.keys(attributes)
    .sort((leftAxis, rightAxis) => leftAxis.localeCompare(rightAxis))
    .map((axis) => `${formatVariantAxisLabel(axis)}: ${attributes[axis]}`);

  if (parts.length > 0) {
    return parts.join(' / ');
  }

  if (typeof sku === 'string' && sku.trim().length > 0) {
    return sku.trim();
  }

  return 'Variant';
}

export function toMobileProductVariants(
  variants: StorefrontVariantRecord[] | null | undefined,
  options: {
    basePrice: number;
    compareAtPrice?: number;
    merchantId: string;
    productId: string;
  }
): ProductVariant[] {
  return normalizeStorefrontProductVariants(variants, {
    merchantId: options.merchantId,
    productId: options.productId,
  }).map((variant) => {
    const attributes = variant.attributes || {};

    return {
      id: variant.id,
      name: buildVariantName(attributes, variant.sku),
      sku: variant.sku,
      price: variant.price_override ?? options.basePrice,
      compare_at_price: options.compareAtPrice,
      price_override: variant.price_override,
      image: variant.primary_image ?? variant.images?.[0],
      images: variant.images,
      in_stock:
        typeof variant.stock_quantity === 'number' && variant.stock_quantity > 0,
      stock_quantity: variant.stock_quantity,
      attributes,
    };
  });
}

export async function fetchStorefrontProductVariants(
  productId: string
): Promise<StorefrontVariantRecord[]> {
  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    throw new TypeError('Invalid productId');
  }

  const result = await withSupabaseRetry(
    async () =>
      await supabase.rpc('get_storefront_product_variants', {
        p_product_ids: [normalizedProductId],
      }),
    {
      maxRetries: 3,
      onRetry: (attempt, error) => {
        log.warn(`Variant RPC retry ${attempt}: ${error.message}`);
      },
    }
  );

  if (result.error) {
    log.warn('Variant RPC failed; throwing error to caller', {
      code: result.error.code,
      message: result.error.message,
    });
    throw result.error;
  }

  if (!Array.isArray(result.data)) {
    return [];
  }

  return result.data
    .map(toStorefrontVariantRecord)
    .filter((variant): variant is StorefrontVariantRecord => variant !== null);
}
