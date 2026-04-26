/**
 * Condition Selector Component
 * Compact chip-style selector for product condition (Open Box, Used, New).
 * Can optionally display per-condition pricing when price is driven by the
 * condition axis itself.
 */

import {
  type CanonicalProductCondition,
  normalizeCanonicalProductCondition,
  sortCanonicalProductConditionsByPreference,
} from '@baci/shared/lib';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { RADIUS, SPACING } from '@/constants/Colors';
import {
  formatPrice,
  formatProductConditionDisplay,
  type ProductCondition,
  type ProductConditionOffer,
} from '@/types/product';

interface ConditionSelectorProps {
  availableConditions?: ProductCondition[];
  currentCondition: string | undefined;
  offers: ProductConditionOffer[];
  selectedCondition: ProductCondition | null;
  onSelect: (condition: ProductCondition) => void;
  basePrice: number;
  showPrices?: boolean;
}

export function ConditionSelector({
  availableConditions,
  currentCondition,
  offers,
  selectedCondition,
  onSelect,
  basePrice,
  showPrices = true,
}: ConditionSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const normalize = (
    value: string | undefined | null
  ): CanonicalProductCondition | null => {
    const normalized = normalizeCanonicalProductCondition(value);
    return normalized || null;
  };

  const baseCondition = normalize(currentCondition);

  // sortCanonicalProductConditionsByPreference already normalizes each entry,
  // filters out empty/null values, and dedupes — no need to wrap with another
  // Set/filter pass here.
  const conditionList = sortCanonicalProductConditionsByPreference([
    baseCondition,
    ...(availableConditions ?? []),
    ...offers.map((offer) => offer.condition),
  ]);

  if (conditionList.length <= 1) {
    return null;
  }

  const effectiveSelected =
    normalize(selectedCondition ?? undefined) ??
    baseCondition ??
    conditionList[0];

  const priceForCondition = (condition: CanonicalProductCondition) => {
    const offer = offers.find(
      (candidate) => normalize(candidate.condition) === condition
    );
    return offer?.price ?? basePrice;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Condition</Text>
      <View
        style={styles.chipRow}
        accessible
        accessibilityRole="radiogroup"
        accessibilityLabel="Condition"
      >
        {conditionList.map((condition) => {
          const isSelected = effectiveSelected === condition;
          const displayLabel = formatProductConditionDisplay(condition);
          const price = priceForCondition(condition);
          const accessibilityLabel = showPrices
            ? `${displayLabel}, ${formatPrice(price)}`
            : displayLabel;

          return (
            <Pressable
              key={condition}
              onPress={() => onSelect(condition)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? `${colors.primary}15`
                    : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ checked: isSelected }}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
              >
                {displayLabel}
              </Text>
              {showPrices ? (
                <Text
                  style={[
                    styles.chipPrice,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                    },
                  ]}
                >
                  {formatPrice(price)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 2,
    minWidth: 96,
    gap: 2,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipPrice: {
    fontSize: 12,
    fontWeight: '500',
  },
});
