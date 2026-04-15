import type { ProductCondition, ProductVariant } from '@/lib/products';

const ALLOWED_PRODUCT_CONDITIONS = [
  'new',
  'used',
  'open_box',
  'refurbished',
] as const satisfies readonly ProductCondition[];

function isAllowedProductCondition(
  condition: string | null | undefined
): condition is ProductCondition {
  return ALLOWED_PRODUCT_CONDITIONS.includes(condition as ProductCondition);
}

interface StorefrontVariantRecord {
  attributes?: Record<string, unknown> | null;
  condition?: string | null;
  id: string;
  images?: unknown;
  merchant_id?: string | null;
  price_override?: number | string | null;
  primary_image?: string | null;
  product_id?: string | null;
  sku?: string | null;
  stock_quantity?: number | null;
}

function normalizeVariantAttributes(
  attributes: Record<string, unknown> | null | undefined
) {
  const normalizedAttributes: Record<string, string> = {};

  for (const [key, value] of Object.entries(attributes || {})) {
    if (typeof value !== 'string') {
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

function normalizeOptionalNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function normalizeVariantImages(images: unknown) {
  if (!Array.isArray(images)) {
    return undefined;
  }

  const normalizedImages = images.filter(
    (image): image is string => typeof image === 'string' && image.length > 0
  );

  return normalizedImages.length > 0 ? normalizedImages : undefined;
}

export function normalizeStorefrontProductVariants(
  variants: StorefrontVariantRecord[] | null | undefined,
  options: {
    merchantId: string;
    productId: string;
  }
): ProductVariant[] {
  return (variants || []).map((variant) => ({
    id: variant.id,
    product_id: variant.product_id || options.productId,
    merchant_id: variant.merchant_id || options.merchantId,
    condition: isAllowedProductCondition(variant.condition)
      ? variant.condition
      : undefined,
    attributes: normalizeVariantAttributes(variant.attributes),
    price_override: normalizeOptionalNumber(variant.price_override),
    stock_quantity:
      typeof variant.stock_quantity === 'number' &&
      Number.isFinite(variant.stock_quantity)
        ? variant.stock_quantity
        : 0,
    images: normalizeVariantImages(variant.images),
    primary_image: variant.primary_image || undefined,
    sku: variant.sku || undefined,
  }));
}
