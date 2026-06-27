import type { NormalizedImportedOrderItem } from '@/lib/imports/bumpa/bumpa-types';

export type ProvisionalBumpaOrderItem = Omit<
  NormalizedImportedOrderItem,
  'unitPrice' | 'lineTotal'
> & {
  provisionalUnitPrice: number | null;
  provisionalLineTotal: number | null;
};

function toMoneyCents(value: number) {
  return Math.round(value * 100);
}

function fromMoneyCents(value: number) {
  return Math.round(value) / 100;
}

export function inferBumpaOrderItemPrices(
  subtotal: number,
  items: ProvisionalBumpaOrderItem[]
) {
  const subtotalCents = toMoneyCents(subtotal);
  const knownCents = items.reduce((sum, item) => {
    if (item.provisionalLineTotal !== null) {
      return sum + toMoneyCents(item.provisionalLineTotal);
    }

    if (item.provisionalUnitPrice === null) return sum;
    return sum + toMoneyCents(item.provisionalUnitPrice * item.quantity);
  }, 0);

  const unknownItems = items.filter(
    (item) =>
      item.provisionalLineTotal === null && item.provisionalUnitPrice === null
  );
  let remainingCents = subtotalCents - knownCents;

  const normalizedItems = items.map((item) => {
    if (item.provisionalLineTotal !== null) {
      const lineTotal = toMoneyCents(item.provisionalLineTotal);
      const unitPrice =
        item.provisionalUnitPrice !== null
          ? item.provisionalUnitPrice
          : fromMoneyCents(lineTotal / Math.max(1, item.quantity));

      return {
        ...item,
        unitPrice,
        lineTotal: fromMoneyCents(lineTotal),
      };
    }

    if (item.provisionalUnitPrice !== null) {
      const lineTotal = toMoneyCents(item.provisionalUnitPrice * item.quantity);
      return {
        ...item,
        unitPrice: item.provisionalUnitPrice,
        lineTotal: fromMoneyCents(lineTotal),
      };
    }

    const itemsLeft = unknownItems.length - unknownItems.indexOf(item);
    const divisor = Math.max(1, item.quantity * itemsLeft);
    const centsPerUnit = Math.max(0, Math.floor(remainingCents / divisor));
    const lineTotalCents = centsPerUnit * item.quantity;
    remainingCents -= lineTotalCents;

    return {
      ...item,
      unitPrice: fromMoneyCents(centsPerUnit),
      lineTotal: fromMoneyCents(lineTotalCents),
    };
  });

  const finalLineTotal = normalizedItems.reduce(
    (sum, item) => sum + toMoneyCents(item.lineTotal),
    0
  );
  const delta = subtotalCents - finalLineTotal;
  const adjustableIndexes = normalizedItems
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.provisionalLineTotal === null && item.provisionalUnitPrice === null
    );

  if (adjustableIndexes.length > 0 && delta !== 0) {
    const targetIndex = adjustableIndexes.reduce((best, candidate) =>
      best.item.lineTotal >= candidate.item.lineTotal ? best : candidate
    ).index;
    const target = normalizedItems[targetIndex];
    const adjustedLineTotal = Math.max(
      0,
      toMoneyCents(target.lineTotal) + delta
    );

    normalizedItems[targetIndex] = {
      ...target,
      unitPrice: fromMoneyCents(
        adjustedLineTotal / Math.max(1, target.quantity)
      ),
      lineTotal: fromMoneyCents(adjustedLineTotal),
    };
  }

  return normalizedItems.map(
    ({
      provisionalLineTotal: _ignoredLineTotal,
      provisionalUnitPrice: _ignoredUnitPrice,
      ...item
    }) => item
  );
}
