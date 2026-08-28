import {
  buildTransactionDiscountLineKey,
  buildTransactionDiscountLineOccurrenceKey,
} from '@baci/shared/contracts';
import { toPositiveInteger } from './transaction-review-positive-integer';

interface PersistedLineKeyItem {
  condition?: string | null;
  line_id?: number | string | null;
  product_id?: string | null;
  variant_attributes?: Record<string, string> | null;
  variant_id?: string | null;
}

export function getPersistedLineKeyOccurrenceOrdinals(
  items: PersistedLineKeyItem[]
): Map<number, number> | undefined {
  const lineKeyCounts = new Map<string, number>();
  const itemIndexesByLineKey = new Map<
    string,
    Array<{ index: number; lineId: number }>
  >();
  const lineKeysWithInvalidLineIds = new Set<string>();

  for (const [index, item] of items.entries()) {
    const lineKey = getPersistedLineKey(item);
    if (lineKey == null) {
      return undefined;
    }
    lineKeyCounts.set(lineKey, (lineKeyCounts.get(lineKey) ?? 0) + 1);

    const lineId = toPositiveInteger(item.line_id);
    if (lineId == null) {
      lineKeysWithInvalidLineIds.add(lineKey);
      continue;
    }

    const entries = itemIndexesByLineKey.get(lineKey) ?? [];
    entries.push({ index, lineId });
    itemIndexesByLineKey.set(lineKey, entries);
  }

  const occurrenceOrdinals = new Map<number, number>();
  for (const [lineKey, itemCount] of lineKeyCounts) {
    if (itemCount < 2) {
      continue;
    }
    const entries = itemIndexesByLineKey.get(lineKey) ?? [];
    if (
      lineKeysWithInvalidLineIds.has(lineKey) ||
      entries.length !== itemCount
    ) {
      return undefined;
    }

    const sortedEntries = [...entries].sort(
      (left, right) => left.lineId - right.lineId
    );
    for (const [entryIndex, entry] of sortedEntries.entries()) {
      if (
        entryIndex > 0 &&
        entry.lineId === sortedEntries[entryIndex - 1]?.lineId
      ) {
        return undefined;
      }
      occurrenceOrdinals.set(entry.index, entryIndex + 1);
    }
  }

  return occurrenceOrdinals;
}

export function getPersistedLineKey(item: PersistedLineKeyItem): string | null {
  if (
    typeof item.product_id !== 'string' ||
    item.product_id.trim().length === 0 ||
    (item.variant_id !== null && typeof item.variant_id !== 'string') ||
    (item.variant_attributes !== null &&
      item.variant_attributes !== undefined &&
      (typeof item.variant_attributes !== 'object' ||
        Array.isArray(item.variant_attributes) ||
        Object.values(item.variant_attributes).some(
          (value) => typeof value !== 'string'
        )))
  ) {
    return null;
  }

  return buildTransactionDiscountLineKey({
    condition: item.condition,
    productId: item.product_id,
    variantAttributes: item.variant_attributes,
    variantId: item.variant_id ?? null,
  });
}

export function getPersistedLineKeyCandidates(
  item: PersistedLineKeyItem,
  occurrenceOrdinal?: number
): string[] {
  const lineKey = getPersistedLineKey(item);
  if (lineKey == null) {
    return [];
  }

  return occurrenceOrdinal == null
    ? [lineKey]
    : [
        lineKey,
        buildTransactionDiscountLineOccurrenceKey(lineKey, occurrenceOrdinal),
      ];
}
