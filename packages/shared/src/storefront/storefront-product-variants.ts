import { canonicalizeVariantAxis } from './variant-attributes';

export interface StorefrontVariantRecord {
  attributes?: Record<string, unknown> | null;
  id: string;
  images?: unknown;
  merchant_id?: string | null;
  price_override?: number | string | null;
  primary_image?: string | null;
  product_id?: string | null;
  sku?: string | null;
  stock_quantity?: number | null;
}

export interface NormalizedStorefrontProductVariant {
  attributes: Record<string, string>;
  id: string;
  images?: string[];
  merchant_id: string;
  price_override?: number;
  primary_image?: string;
  product_id: string;
  sku?: string;
  stock_quantity: number;
}

function normalizeVariantAttributes(
  attributes: Record<string, unknown> | null | undefined
) {
  const normalizedAttributes: Record<string, string> = {};

  for (const [rawKey, value] of Object.entries(attributes || {})) {
    if (typeof value !== 'string') {
      continue;
    }

    const key = canonicalizeVariantAxis(rawKey);
    if (!key) {
      continue;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      continue;
    }

    normalizedAttributes[key] = trimmedValue;
  }

  return normalizedAttributes;
}

/**
 * Normalizes storefront numeric inputs and discards negatives, empties, and
 * non-finite values. Storefront variant price overrides are non-negative only.
 */
function normalizeOptionalNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : undefined;
  }

  return undefined;
}

function normalizeVariantImages(images: unknown) {
  if (!Array.isArray(images)) {
    return undefined;
  }

  const normalizedImages = images
    .filter((image): image is string => typeof image === 'string')
    .map((image) => image.trim())
    .filter((image) => image.length > 0);

  return normalizedImages.length > 0 ? normalizedImages : undefined;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeStockQuantity(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

export function normalizeStorefrontProductVariants(
  variants: StorefrontVariantRecord[] | null | undefined,
  options: {
    merchantId: string;
    productId: string;
  }
): NormalizedStorefrontProductVariant[] {
  return (variants || []).flatMap((variant) => {
    const normalizedId = normalizeOptionalText(variant.id);

    if (!normalizedId) {
      return [];
    }

    return {
      id: normalizedId,
      product_id: normalizeOptionalText(variant.product_id) ?? options.productId,
      merchant_id:
        normalizeOptionalText(variant.merchant_id) ?? options.merchantId,
      attributes: normalizeVariantAttributes(variant.attributes),
      price_override: normalizeOptionalNumber(variant.price_override),
      stock_quantity: normalizeStockQuantity(variant.stock_quantity),
      images: normalizeVariantImages(variant.images),
      primary_image: normalizeOptionalText(variant.primary_image),
      sku: normalizeOptionalText(variant.sku),
    };
  });
}
