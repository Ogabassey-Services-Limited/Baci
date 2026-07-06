import { OrderShipmentBookingError } from './order-shipment-booking-utils';
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
const METADATA_TOLERANCE = 0.001;

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

function readOptionalNonNegativeNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
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

function hasProductWeight(product: ProductShippingMetadata | null): boolean {
  return readPositiveNumber(product?.weight_value) !== undefined;
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

function numbersMatch(left: number | undefined, right: number | undefined) {
  if (left === undefined || right === undefined) return left === right;
  return Math.abs(left - right) <= METADATA_TOLERANCE;
}

function dimensionsMatch(
  expected: PackageDimensions | undefined,
  quoted: ShipmentItem
): boolean {
  const quotedDimensions =
    quoted.length !== undefined ||
    quoted.width !== undefined ||
    quoted.height !== undefined
      ? {
          length: quoted.length,
          width: quoted.width,
          height: quoted.height,
        }
      : undefined;

  if (!expected && !quotedDimensions) return true;
  if (!expected || !quotedDimensions) return false;
  return (
    numbersMatch(expected.length, quotedDimensions.length) &&
    numbersMatch(expected.width, quotedDimensions.width) &&
    numbersMatch(expected.height, quotedDimensions.height)
  );
}

function findMatchingQuoteItem(
  item: InternationalShipmentOrderItem,
  quoteItems: ShipmentItem[]
): ShipmentItem | undefined {
  const itemQuantity = Math.max(1, item.quantity ?? 1);
  const itemName = normalizeText(item.name);
  return quoteItems.find(
    (quoteItem) =>
      normalizeText(quoteItem.name) === itemName &&
      quoteItem.quantity === itemQuantity
  );
}

function throwMetadataMismatch(): never {
  throw new OrderShipmentBookingError(
    'The saved international shipping quote no longer matches the current product shipping details. Please get a new quote before shipping.',
    400,
    'INTERNATIONAL_QUOTE_ITEM_METADATA_MISMATCH'
  );
}

function validateQuotedPhysicalMetadata({
  dimensions,
  product,
  quoteItem,
  weight,
}: {
  dimensions: PackageDimensions | undefined;
  product: ProductShippingMetadata | null;
  quoteItem: ShipmentItem | undefined;
  weight: number;
}) {
  if (!quoteItem) return;

  if (hasProductWeight(product) && !numbersMatch(weight, quoteItem.weight)) {
    throwMetadataMismatch();
  }

  if (!dimensionsMatch(dimensions, quoteItem)) {
    throwMetadataMismatch();
  }
}

export function toInternationalShipmentItemsFromOrder(
  orderItems: InternationalShipmentOrderItem[],
  quoteItems: ShipmentItem[] = []
): ShipmentItem[] {
  return orderItems.map((item) => {
    const product = readProductMetadata(item);
    const hsCode = product?.commodity_code?.trim() || undefined;
    const dimensions = readPackageDimensions(product);
    const name = item.name || 'Order item';
    const quantity = Math.max(1, item.quantity ?? 1);
    const weight = normalizeWeightKg(product);
    const quoteItem = findMatchingQuoteItem(item, quoteItems);
    validateQuotedPhysicalMetadata({ dimensions, product, quoteItem, weight });

    return {
      name,
      description: name,
      quantity,
      weight,
      value:
        readOptionalNonNegativeNumber(quoteItem?.value) ??
        readNonNegativeNumber(item.price),
      ...(hsCode ? { hsCode } : {}),
      ...(dimensions ?? {}),
    };
  });
}
