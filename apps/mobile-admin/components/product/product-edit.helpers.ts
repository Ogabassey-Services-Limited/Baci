import type { ThemeColors } from '@/constants/theme';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';
import { formatProductCondition } from '@/lib/product-condition';
import type { EditableProductVariant } from '@/lib/product-variant-form';

export function getCurrencySymbol(currencyCode: string | null | undefined) {
  const symbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    USD: '$',
  };

  return symbols[currencyCode || 'NGN'] || '₦';
}

export function getVariantSummaryLabel(
  variant: EditableProductVariant,
  index: number
) {
  const conditionLabel = formatProductCondition(variant.condition);
  const attributeSummary = formatVariantAttributesSummary(
    Object.fromEntries(
      variant.attributes
        .map((attribute) => [attribute.key.trim(), attribute.value.trim()])
        .filter(([key, value]) => key && value)
    )
  );

  return (
    [conditionLabel, attributeSummary].filter(Boolean).join(' • ') ||
    `Variant ${index + 1}`
  );
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
