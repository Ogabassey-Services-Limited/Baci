/**
 * Builders for persisting what a whole-cart ("total") negotiation is actually
 * about. Historically `type: 'total'` offers were inserted with `cart_snapshot`
 * AND `item_info` both null, so merchants saw an offer amount with no way to
 * know which items it covered. These helpers produce a stable, platform-neutral
 * snapshot + a short `item_info` summary so the admin app can render something
 * meaningful.
 *
 * Web and mobile carts have different field names, so each platform maps its own
 * cart item into a `NegotiationCartLine` first, then calls these helpers — one
 * source of truth for the persisted JSON shape.
 */

import { isFiniteNumber } from './is-finite-number';

/** A single normalized line item in a persisted cart snapshot. */
export interface NegotiationCartLine {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant_id?: string;
  variant_name?: string;
  brand?: string;
  condition?: string;
}

/** Shape the admin app reads to label a negotiation. */
export interface NegotiationItemInfo {
  id?: string;
  name: string;
  image?: string;
  current_price?: number;
  product_slug?: string;
  variant_id?: string;
  variant_name?: string;
  variant_attributes?: Record<string, string>;
  brand?: string;
  condition?: string;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalize raw cart lines into the persisted snapshot shape, dropping
 * malformed entries (missing id/name) and coercing prices/quantities to safe
 * numbers so a bad line can never blow up the insert.
 */
export function buildCartSnapshot(
  lines: readonly Partial<NegotiationCartLine>[]
): NegotiationCartLine[] {
  return lines.reduce<NegotiationCartLine[]>((acc, line) => {
    const productId = cleanString(line.product_id);
    const name = cleanString(line.name);
    if (!productId || !name) {
      return acc;
    }

    const price =
      isFiniteNumber(line.price) && line.price >= 0 ? line.price : 0;
    const quantity =
      isFiniteNumber(line.quantity) && line.quantity > 0
        ? Math.floor(line.quantity)
        : 1;

    const snapshotLine: NegotiationCartLine = {
      product_id: productId,
      name,
      price,
      quantity,
    };

    const image = cleanString(line.image);
    if (image) snapshotLine.image = image;
    const variantId = cleanString(line.variant_id);
    if (variantId) snapshotLine.variant_id = variantId;
    const variantName = cleanString(line.variant_name);
    if (variantName) snapshotLine.variant_name = variantName;
    const brand = cleanString(line.brand);
    if (brand) snapshotLine.brand = brand;
    const condition = cleanString(line.condition);
    if (condition) snapshotLine.condition = condition;

    acc.push(snapshotLine);
    return acc;
  }, []);
}

const MAX_SUMMARY_NAMES = 3;

/**
 * Build the `item_info` summary the admin list renders for a whole-cart offer:
 * a short "N items: A, B, C…" name, the first item's image, and the pre-offer
 * cart total. Returns null when the snapshot is empty so callers can fall back.
 */
export function summarizeCartForItemInfo(
  snapshot: readonly NegotiationCartLine[],
  currentPrice: number
): NegotiationItemInfo | null {
  if (snapshot.length === 0) {
    return null;
  }

  const totalUnits = snapshot.reduce((sum, line) => sum + line.quantity, 0);
  const names = snapshot.slice(0, MAX_SUMMARY_NAMES).map((line) => line.name);
  const remaining = snapshot.length - names.length;
  const namePart =
    remaining > 0 ? `${names.join(', ')} +${remaining}` : names.join(', ');
  const itemWord = totalUnits === 1 ? 'item' : 'items';

  const info: NegotiationItemInfo = {
    name: `${totalUnits} ${itemWord}: ${namePart}`,
  };

  const firstImage = snapshot.find((line) => line.image)?.image;
  if (firstImage) {
    info.image = firstImage;
  }
  if (isFiniteNumber(currentPrice) && currentPrice >= 0) {
    info.current_price = currentPrice;
  }

  return info;
}
