/**
 * Resolve which unit indexes a multi-unit order-item line should be split into
 * for transaction review.
 *
 * Once any per-unit data exists (a fulfillment unit or an `order_item_unit_costs`
 * row), every unit of the line must be rendered — otherwise units without a
 * recorded cost silently drop out and `missingCostCount`/`estimatedProfit`
 * undercount the transaction. So when at least one unit is recorded on a
 * multi-unit line, expand to the full `0..quantity-1` range. Any recorded index
 * outside that range (e.g. stale/out-of-range data) is kept too, so nothing is
 * hidden. When no per-unit data exists the line stays as a single combined row
 * (empty result).
 */
export function resolveSplitUnitIndexes(
  recordedUnitIndexes: Iterable<number>,
  quantity: number
): number[] {
  const recorded = new Set(recordedUnitIndexes);
  const shouldExpand = recorded.size > 0 && quantity > 1;
  const indexes = shouldExpand
    ? new Set([
        ...Array.from({ length: quantity }, (_, index) => index),
        ...recorded,
      ])
    : recorded;
  return Array.from(indexes).sort((left, right) => left - right);
}
