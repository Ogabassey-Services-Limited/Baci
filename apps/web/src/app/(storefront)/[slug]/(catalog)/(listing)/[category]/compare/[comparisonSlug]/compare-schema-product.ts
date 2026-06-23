import { PLACEHOLDER_IMAGE } from '@/lib/image-utils';
import type { buildProductCompareItemListSchema } from '@/lib/storefront-compare/compare-schema';

export type ProductCompareSchemaProduct = Parameters<
  typeof buildProductCompareItemListSchema
>[0]['products'][number];

export function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeStructuredDataImageUrl(
  value: string,
  baseUrl: string
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === PLACEHOLDER_IMAGE) {
    return '';
  }

  try {
    const url = new URL(trimmed, baseUrl);
    const isHttpImage = url.protocol === 'http:' || url.protocol === 'https:';
    const isPlaceholder =
      url.pathname === PLACEHOLDER_IMAGE ||
      url.pathname.endsWith(PLACEHOLDER_IMAGE);

    return isHttpImage && !isPlaceholder ? url.toString() : '';
  } catch {
    return '';
  }
}

export function getStructuredDataImage(
  product: Record<string, unknown>,
  baseUrl: string
): string {
  if (typeof product.image === 'string') {
    const image = normalizeStructuredDataImageUrl(product.image, baseUrl);
    if (image) {
      return image;
    }
  }

  if (!Array.isArray(product.images)) {
    return '';
  }

  for (const image of product.images) {
    if (typeof image === 'string') {
      const imageUrl = normalizeStructuredDataImageUrl(image, baseUrl);
      if (imageUrl) {
        return imageUrl;
      }
    }

    const imageRecord = getRecord(image);
    if (typeof imageRecord?.url === 'string') {
      const imageUrl = normalizeStructuredDataImageUrl(
        imageRecord.url,
        baseUrl
      );
      if (imageUrl) {
        return imageUrl;
      }
    }
  }

  return '';
}

export function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getStructuredDataAvailability(
  product: Record<string, unknown>
): ProductCompareSchemaProduct['availability'] {
  if (
    product.availability === 'InStock' ||
    product.availability === 'OutOfStock'
  ) {
    return product.availability;
  }

  if (typeof product.availability === 'string') {
    const normalized = product.availability.toLowerCase();
    if (
      normalized.includes('outofstock') ||
      normalized.includes('out_of_stock')
    ) {
      return 'OutOfStock';
    }
    if (normalized.includes('instock') || normalized.includes('in_stock')) {
      return 'InStock';
    }
  }

  if (typeof product.status === 'string') {
    const normalizedStatus = product.status.toLowerCase();
    if (
      normalizedStatus === 'out_of_stock' ||
      normalizedStatus === 'sold_out'
    ) {
      return 'OutOfStock';
    }
  }

  if (typeof product.in_stock === 'boolean') {
    return product.in_stock ? 'InStock' : 'OutOfStock';
  }

  if (
    'manage_stock' in product &&
    (product.manage_stock == null || product.manage_stock === false)
  ) {
    return 'InStock';
  }

  if (
    !('manage_stock' in product) &&
    ('stock_quantity' in product || 'stock' in product)
  ) {
    return 'InStock';
  }

  const stockQuantity =
    toOptionalNumber(product.stock_quantity) ?? toOptionalNumber(product.stock);
  if (stockQuantity !== null) {
    return stockQuantity > 0 ? 'InStock' : 'OutOfStock';
  }

  return undefined;
}

export function toProductCompareSchemaProduct(
  product: unknown,
  baseUrl: string
): ProductCompareSchemaProduct | null {
  const record = getRecord(product);
  if (!record) return null;

  const id =
    typeof record.id === 'string' || typeof record.id === 'number'
      ? String(record.id)
      : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const image = getStructuredDataImage(record, baseUrl);

  if (!id || !name || !image) {
    return null;
  }

  return {
    id,
    name,
    image,
    availability: getStructuredDataAvailability(record),
    category: typeof record.category === 'string' ? record.category : null,
    category_slug:
      typeof record.category_slug === 'string' ? record.category_slug : null,
    description:
      typeof record.description === 'string' ? record.description : null,
    price: toOptionalNumber(record.price),
    slug: typeof record.slug === 'string' ? record.slug : undefined,
  };
}
