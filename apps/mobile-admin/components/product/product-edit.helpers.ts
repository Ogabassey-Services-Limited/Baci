import type { ThemeColors } from '@/constants/theme';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';
import { formatProductCondition } from '@/lib/product-condition';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { isMetaAttributeKey } from '@/lib/variant-attribute-display';

export { getCurrencySymbol } from './product.shared';

export function getVariantSummaryLabel(
  variant: EditableProductVariant,
  index: number
) {
  const conditionLabel = formatProductCondition(variant.condition);
  const attributeSummary = formatVariantAttributesSummary(
    Object.fromEntries(
      variant.attributes
        // Never surface machine attributes (e.g. color_hex) in the row title.
        .filter((attribute) => !isMetaAttributeKey(attribute.key))
        .map((attribute) => [attribute.key.trim(), attribute.value.trim()])
        .filter(([key, value]) => key && value)
    )
  );

  return (
    [conditionLabel, attributeSummary].filter(Boolean).join(' • ') ||
    `Variant ${index + 1}`
  );
}

/**
 * Compact price + stock line shown under a collapsed variant row so the whole
 * list is scannable without expanding each variant.
 */
export function getVariantSummaryMeta(
  variant: EditableProductVariant,
  currencySymbol: string
): string {
  const priceLabel =
    variant.price > 0
      ? `${currencySymbol}${variant.price.toLocaleString('en-US')}`
      : 'No price set';
  const stockLabel = `${variant.stock_quantity} in stock`;

  return `${priceLabel} • ${stockLabel}`;
}

export function calculateProfitMargin(
  colors: ThemeColors,
  price: number,
  costPrice: number
) {
  if (!costPrice || costPrice <= 0) {
    return {
      active: false,
      color: colors.textSecondary,
      percentage: '0.0%',
      profit: 0,
    };
  }

  const profit = price - costPrice;
  const percentage =
    price > 0 ? `${((profit / price) * 100).toFixed(1)}%` : '0.0%';
  const color =
    profit > 0
      ? colors.success
      : profit < 0
        ? colors.error
        : colors.textSecondary;

  return { active: true, color, percentage, profit };
}
