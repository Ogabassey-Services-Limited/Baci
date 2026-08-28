/**
 * Server-authored discount provenance persisted with an order.  Product and
 * variant identity are copied into `order_items` by the storefront-order RPC,
 * so consumers do not depend on the order in which Supabase returns the
 * embedded relation. `lineId` remains the request ordinal for backwards
 * compatibility and diagnostics; it is not the persisted matching key.
 */
export const TRANSACTION_DISCOUNT_METADATA_KEY = 'baci_transaction_discount';

export interface TransactionDiscountLineAllocation {
  lineId: number;
  /** Present in version 3; omitted by legacy version-2 metadata. */
  productId?: string;
  /** Present in version 3; omitted by legacy version-2 metadata. */
  variantId?: string | null;
  /** Present when product/variant alone cannot uniquely identify a line. */
  lineKey?: string;
  merchandiseDiscount: number;
  vatRelief: number;
}

interface TransactionDiscountLineKeyInput {
  condition?: string | null;
  productId: string;
  variantAttributes?: Record<string, string> | null;
  variantId: string | null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

/**
 * Builds a deterministic identity from fields that the storefront order RPC
 * copies into each order item. It disambiguates duplicate product/variant
 * lines without depending on the RPC's generated line-id sequence.
 */
export function buildTransactionDiscountLineKey({
  condition,
  productId,
  variantAttributes,
  variantId,
}: TransactionDiscountLineKeyInput): string {
  return stableStringify([
    productId,
    variantId,
    condition ?? null,
    variantAttributes ?? {},
  ]);
}

/**
 * Adds the persisted line occurrence to a canonical key when two order lines
 * have the same product, variant, condition, and attributes.
 */
export function buildTransactionDiscountLineOccurrenceKey(
  lineKey: string,
  lineId: number
): string {
  return `${lineKey}#line:${lineId}`;
}

export interface TransactionDiscountMetadata {
  lineDiscounts: Array<TransactionDiscountLineAllocation | null>;
  version: 3;
}
