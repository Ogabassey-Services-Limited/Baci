import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';

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
  price: number;
  sku: string | null;
  variant_attributes: unknown;
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
      variant_attributes: variant.attributes ?? null,
    };
  });
}
