import type { VariantAttributeValue, VariantAttributes } from '@baci/shared';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';

export type { VariantAttributes } from '@baci/shared';

export interface ProductPickerVariantParent {
  condition?: string | null;
  images?: string[] | null;
  name: string;
  price: number;
}

export interface ProductPickerVariantRow {
  attributes?: unknown;
  condition?: string | null;
  cost_price?: number | string | null;
  id: string;
  images?: string[] | null;
  price_override?: number | string | null;
  primary_image?: string | null;
  sku?: string | null;
  stock_quantity?: number | null;
}

export interface SelectableProductPickerItem {
  condition?: string | null;
  has_variants: boolean;
  id: string;
  images: string[];
  name: string;
  parent_product_id?: string | null;
  price: number;
  sku: string | null;
  variant_attributes: VariantAttributes | null;
}

export interface AdminProductVariant extends SelectableProductPickerItem {
  cost_price: number | null;
  parent_product_id: string | null;
  primary_image: string | null;
  source: 'structured';
  stock_quantity: number;
}

function normalizePrice(
  value: number | string | null | undefined,
  fallback: number
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeImages(args: {
  fallbackImages?: string[] | null;
  images?: string[] | null;
  primaryImage?: string | null;
}): string[] {
  if (Array.isArray(args.images) && args.images.length > 0) {
    return args.images.filter(Boolean);
  }

  if (args.primaryImage) {
    return [args.primaryImage];
  }

  return (args.fallbackImages ?? []).filter(Boolean);
}

const INVALID_VARIANT_ATTRIBUTE = Symbol('invalid_variant_attribute');

function normalizeVariantAttributeValue(
  value: unknown
): VariantAttributeValue | typeof INVALID_VARIANT_ATTRIBUTE {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return INVALID_VARIANT_ATTRIBUTE;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : INVALID_VARIANT_ATTRIBUTE;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = normalizeVariantAttributeValue(entry);
      return normalized === INVALID_VARIANT_ATTRIBUTE ? null : normalized;
    });
  }

  if (typeof value !== 'object') {
    return INVALID_VARIANT_ATTRIBUTE;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(
      ([key, entryValue]) => {
        const normalized = normalizeVariantAttributeValue(entryValue);
        return normalized === INVALID_VARIANT_ATTRIBUTE
          ? []
          : [[key, normalized]];
      }
    )
  );
}

function normalizeVariantAttributeArray(value: unknown[]): VariantAttributes | null {
  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const key =
      typeof record.key === 'string'
        ? record.key
        : typeof record.param === 'string'
          ? record.param
          : typeof record.name === 'string'
            ? record.name
            : null;

    if (!key) {
      return [];
    }

    const rawValue =
      record.value !== undefined
        ? record.value
        : record.label !== undefined
          ? record.label
          : record.options !== undefined
            ? record.options
            : record.name;
    const normalized = normalizeVariantAttributeValue(rawValue);

    return normalized === INVALID_VARIANT_ATTRIBUTE
      ? []
      : [[key, normalized] as const];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function normalizeVariantAttributes(
  value: unknown
): VariantAttributes | null {
  if (Array.isArray(value)) {
    return normalizeVariantAttributeArray(value);
  }

  const normalized = normalizeVariantAttributeValue(value);
  if (
    normalized === INVALID_VARIANT_ATTRIBUTE ||
    normalized === null ||
    typeof normalized !== 'object' ||
    Array.isArray(normalized)
  ) {
    return null;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function buildStructuredVariantPickerItems(args: {
  parentProductId?: string | null;
  parentProduct: ProductPickerVariantParent;
  variants: ProductPickerVariantRow[];
}): AdminProductVariant[] {
  return args.variants.map((variant) => {
    const variantSummary = formatVariantAttributesSummary(variant.attributes);

    return {
      cost_price: normalizePrice(variant.cost_price, 0) || null,
      condition: variant.condition ?? null,
      has_variants: false,
      id: variant.id,
      images: normalizeImages({
        fallbackImages: args.parentProduct.images,
        images: variant.images,
        primaryImage: variant.primary_image,
      }),
      name: variantSummary
        ? `${args.parentProduct.name} ${variantSummary}`
        : args.parentProduct.name,
      parent_product_id: args.parentProductId ?? null,
      price: normalizePrice(variant.price_override, args.parentProduct.price),
      primary_image: variant.primary_image ?? null,
      sku: variant.sku ?? null,
      source: 'structured',
      stock_quantity: variant.stock_quantity ?? 0,
      variant_attributes: normalizeVariantAttributes(variant.attributes),
    };
  });
}
