import { createLogger } from '@/lib/logger';
import {
  normalizeColorImages,
  normalizeProductColors,
  normalizeSpecifications,
  sanitizeConditionNotes,
  sanitizeOptionalHtml,
} from '@/lib/storefront-product-transform-normalizers';
import { ProductRowSchema } from '@/lib/validation';
import type { Product, ProductConditionOffer } from '@/types/product';

const log = createLogger('StorefrontProductTransform');
const VALID_PRODUCT_CONDITIONS = [
  'New',
  'Used',
  'UK Used',
  'Open Box',
  'Refurbished',
  'New & Used',
] as const;
const VALID_OFFER_CONDITIONS = [
  'new',
  'used',
  'uk_used',
  'open_box',
  'refurbished',
] as const;
const VALID_OFFER_GRADES = ['A', 'B', 'C', 'D'] as const;

function getProductDiagnostics(item: unknown) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {
      id: '',
      slug: '',
    };
  }

  const record = item as Record<string, unknown>;

  return {
    id: typeof record.id === 'string' ? record.id : '',
    slug: typeof record.slug === 'string' ? record.slug : '',
  };
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return 0;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function normalizePrimitiveString(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return '';
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function normalizeProductCondition(
  value: unknown
): Product['condition'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return VALID_PRODUCT_CONDITIONS.includes(
    normalizedValue as (typeof VALID_PRODUCT_CONDITIONS)[number]
  )
    ? (normalizedValue as Product['condition'])
    : undefined;
}

function normalizeOfferCondition(
  value: unknown
): ProductConditionOffer['condition'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return VALID_OFFER_CONDITIONS.includes(
    normalizedValue as (typeof VALID_OFFER_CONDITIONS)[number]
  )
    ? (normalizedValue as ProductConditionOffer['condition'])
    : undefined;
}

function normalizeOfferGrade(
  value: unknown
): ProductConditionOffer['grade'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toUpperCase();

  return VALID_OFFER_GRADES.includes(
    normalizedValue as (typeof VALID_OFFER_GRADES)[number]
  )
    ? (normalizedValue as ProductConditionOffer['grade'])
    : undefined;
}

function getCategoryName(value: unknown): string {
  if (Array.isArray(value)) {
    const category = value[0];

    if (category && typeof category === 'object' && 'name' in category) {
      return typeof category.name === 'string' ? category.name : '';
    }

    return '';
  }

  if (value && typeof value === 'object' && 'name' in value) {
    return typeof value.name === 'string' ? value.name : '';
  }

  return '';
}

function normalizeProductOffers(
  offers: unknown
): ProductConditionOffer[] | undefined {
  if (!Array.isArray(offers) || offers.length === 0) {
    return undefined;
  }

  const normalizedOffers: ProductConditionOffer[] = [];

  for (const offer of offers) {
    if (!offer || typeof offer !== 'object') {
      continue;
    }

    const condition = normalizeOfferCondition(
      (offer as { condition?: ProductConditionOffer['condition'] }).condition
    );

    if (!condition) {
      continue;
    }

    normalizedOffers.push({
      id: normalizePrimitiveString((offer as { id?: unknown }).id),
      condition,
      price: normalizeNumber((offer as { price?: unknown }).price),
      compare_at_price: normalizeOptionalNumber(
        (offer as { compare_at_price?: unknown }).compare_at_price
      ),
      stock_quantity: normalizeOptionalNumber(
        (offer as { stock_quantity?: unknown }).stock_quantity
      ),
      images: normalizeStringArray((offer as { images?: unknown }).images),
      condition_notes: sanitizeConditionNotes(
        (offer as { condition_notes?: unknown }).condition_notes
      ),
      grade: normalizeOfferGrade(
        (offer as { grade?: ProductConditionOffer['grade'] | null }).grade
      ),
    });
  }

  return normalizedOffers.length > 0 ? normalizedOffers : undefined;
}

export function transformProduct(item: unknown): Product {
  const validated = ProductRowSchema.safeParse(item);
  if (!validated.success) {
    log.warn('Falling back to unvalidated product payload', {
      ...getProductDiagnostics(item),
      issues: validated.error.issues,
    });
  }

  const product =
    validated.success
      ? validated.data
      : item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
  const normalizedImages = normalizeStringArray(product.images);
  const description = sanitizeOptionalHtml(product.description);
  const compareAtPrice = normalizeOptionalNumber(product.compare_at_price);
  // Brand is merchant-authored display text; avoid coercing non-string data.
  const brand = typeof product.brand === 'string' ? product.brand : undefined;
  const manageStock = product.manage_stock === true;
  const stockQuantity = normalizeOptionalNumber(product.stock_quantity);

  return {
    id: normalizePrimitiveString(product.id),
    merchant_id:
      typeof (product as { merchant_id?: unknown }).merchant_id === 'string'
        ? (product as { merchant_id: string }).merchant_id
        : undefined,
    name: normalizePrimitiveString(product.name),
    slug: normalizePrimitiveString(product.slug),
    description,
    price: normalizeNumber(product.price),
    compare_at_price: compareAtPrice,
    image: normalizedImages?.[0] ?? '',
    images: normalizedImages ?? [],
    brand,
    category: getCategoryName(product.categories),
    condition: normalizeProductCondition(product.condition),
    manage_stock: manageStock,
    stock_quantity: stockQuantity,
    in_stock: !manageStock || (stockQuantity ?? 0) > 0,
    has_variants: product.has_variants === true,
    colors: normalizeProductColors(
      (product as { colors?: Product['colors'] | null }).colors
    ),
    color_images: normalizeColorImages(
      (product as { color_images?: Product['color_images'] | null })
        .color_images
    ),
    specifications: normalizeSpecifications(
      (product as { specifications?: Product['specifications'] | null })
        .specifications
    ),
    has_condition_offers: product.has_condition_offers === true,
    offers: normalizeProductOffers(
      (product as { offers?: unknown[] | null }).offers
    ),
  };
}
