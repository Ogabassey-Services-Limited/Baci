import type { ShipmentItem } from './types';

export type ProductShippingMetadata = {
  weight_value?: number | string | null;
  weight_unit?: string | null;
  dimensions?: unknown;
  commodity_code?: string | null;
};

export type InternationalShipmentOrderItem = {
  name: string | null;
  quantity: number | null;
  price: number | string | null;
  product?: ProductShippingMetadata | ProductShippingMetadata[] | null;
  products?: ProductShippingMetadata | ProductShippingMetadata[] | null;
};

type PackageDimensions = Pick<ShipmentItem, 'length' | 'width' | 'height'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPositiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function readNonNegativeNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : 0;
}

function readProductMetadata(
  item: InternationalShipmentOrderItem
): ProductShippingMetadata | null {
  const relatedProduct = item.product ?? item.products;
  const product = Array.isArray(relatedProduct)
    ? relatedProduct[0]
    : relatedProduct;
  return product && typeof product === 'object' ? product : null;
}

function normalizeWeightKg(product: ProductShippingMetadata | null): number {
  const weight = readPositiveNumber(product?.weight_value);
  if (!weight) return 1;

  switch (product?.weight_unit?.toLowerCase()) {
    case 'g':
      return weight / 1000;
    case 'lb':
      return weight * 0.453_592_37;
    case 'oz':
      return weight * 0.028_349_523_125;
    default:
      return weight;
  }
}

function normalizeDimensionCm(
  value: unknown,
  unit: string | undefined
): number | undefined {
  const dimension = readPositiveNumber(value);
  if (!dimension) return undefined;

  switch (unit?.toLowerCase()) {
    case 'in':
      return dimension * 2.54;
    case 'm':
      return dimension * 100;
    case 'mm':
      return dimension / 10;
    default:
      return dimension;
  }
}

function readPackageDimensions(
  product: ProductShippingMetadata | null
): PackageDimensions | undefined {
  if (!isRecord(product?.dimensions)) return undefined;

  const unit =
    typeof product.dimensions.unit === 'string'
      ? product.dimensions.unit
      : undefined;
  const length = normalizeDimensionCm(
    product.dimensions.length ?? product.dimensions.depth,
    unit
  );
  const width = normalizeDimensionCm(product.dimensions.width, unit);
  const height = normalizeDimensionCm(product.dimensions.height, unit);

  return length && width && height ? { length, width, height } : undefined;
}

export function toInternationalShipmentItemsFromOrder(
  orderItems: InternationalShipmentOrderItem[]
): ShipmentItem[] {
  return orderItems.map((item) => {
    const product = readProductMetadata(item);
    const hsCode = product?.commodity_code?.trim() || undefined;
    const dimensions = readPackageDimensions(product);
    const name = item.name || 'Order item';

    return {
      name,
      description: name,
      quantity: Math.max(1, item.quantity ?? 1),
      weight: normalizeWeightKg(product),
      value: readNonNegativeNumber(item.price),
      ...(hsCode ? { hsCode } : {}),
      ...(dimensions ?? {}),
    };
  });
}
