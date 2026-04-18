/**
 * Condition Selector Component
 * Allows users to select product condition (New, Used, Refurbished, etc.)
 * Updates pricing based on selected condition offer
 */

import {
  type CanonicalProductCondition,
  normalizeCanonicalProductCondition,
} from '@baci/shared/lib';
import { Ionicons } from '@expo/vector-icons';
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
}

const CONDITION_CONFIG: Record<
  CanonicalProductCondition,
  {
    colorToken: 'primary' | 'success' | 'warning';
    description: string;
    icon: string;
  }
> = {
  new: {
    colorToken: 'success',
    icon: 'sparkles',
    description: 'Brand new, sealed',
  },
  used: {
    colorToken: 'warning',
    icon: 'refresh',
    description: 'Pre-owned, tested',
  },
  open_box: {
    colorToken: 'primary',
    icon: 'cube-outline',
    description: 'Certified open-box stock',
  },
};

const GRADE_LABELS: Record<string, string> = {
  A: 'Like New',
  B: 'Good',
  C: 'Fair',
  D: 'Acceptable',
};

export function ConditionSelector({
  availableConditions,
  currentCondition,
  offers,
  selectedCondition,
  onSelect,
  basePrice,
}: ConditionSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Normalize current condition to match our condition type
  const normalizeCondition = (
    cond: string | undefined
  ): CanonicalProductCondition | null => {
    const normalized = normalizeCanonicalProductCondition(cond);
    return normalized || null;
  };

  const baseCondition = normalizeCondition(currentCondition);

  // Build available conditions from explicit list + offers + base condition
  const renderedConditions: Array<{
    condition: CanonicalProductCondition;
    price: number;
    comparePrice?: number;
    stock?: number;
    grade?: string;
    notes?: string;
  }> = [];

  const conditionList = Array.from(
    new Set([
      ...(baseCondition ? [baseCondition] : []),
      ...(availableConditions ?? []).map((condition) =>
        normalizeCondition(condition)
      ),
      ...offers.map((offer) => normalizeCondition(offer.condition)),
    ])
  ).filter(
    (condition): condition is CanonicalProductCondition =>
      condition !== null && condition in CONDITION_CONFIG
  );

  for (const condition of conditionList) {
    const offer = offers.find(
      (candidate) => normalizeCondition(candidate.condition) === condition
    );
    renderedConditions.push({
      condition,
      price: offer?.price ?? basePrice,
      comparePrice: offer?.compare_at_price,
      stock: offer?.stock_quantity,
      grade: offer?.grade,
      notes: offer?.condition_notes,
    });
  }

  // If only one condition available, don't show selector
  if (renderedConditions.length <= 1) {
    return null;
  }

  const effectiveSelected =
    normalizeCondition(selectedCondition ?? undefined) ??
    baseCondition ??
    renderedConditions[0]?.condition;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Condition</Text>
      <View style={styles.optionsContainer}>
        {renderedConditions.map((item) => {
          const config = CONDITION_CONFIG[item.condition];
          const accentColor = colors[config.colorToken];
          const displayLabel = formatProductConditionDisplay(item.condition);
          const isSelected = effectiveSelected === item.condition;
          const savings = basePrice - item.price;
          const hasSavings = savings > 0 && item.condition !== baseCondition;

          return (
            <Pressable
              key={item.condition}
              onPress={() => onSelect(item.condition)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? `${accentColor}15`
                    : colors.card,
                  borderColor: isSelected ? accentColor : colors.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={`${displayLabel}${item.grade ? `, Grade ${item.grade}` : ''}${item.price ? `, ${formatPrice(item.price)}` : ''}`}
              accessibilityState={{ checked: isSelected }}
            >
              <View style={styles.optionHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${accentColor}20` },
                  ]}
                >
                  <Ionicons
                    name={
                      config.icon as React.ComponentProps<
                        typeof Ionicons
                      >['name']
                    }
                    size={16}
                    color={accentColor}
                  />
                </View>
                <View style={styles.labelContainer}>
                  <Text
                    style={[
                      styles.conditionLabel,
                      { color: isSelected ? accentColor : colors.text },
                    ]}
                  >
                    {displayLabel}
                  </Text>
                  {item.grade && (
                    <Text
                      style={[
                        styles.gradeText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Grade {item.grade} • {GRADE_LABELS[item.grade]}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={accentColor}
                  />
                )}
              </View>

              <View style={styles.priceRow}>
                <Text
                  style={[
                    styles.priceText,
                    { color: isSelected ? accentColor : colors.text },
                  ]}
                >
                  {formatPrice(item.price)}
                </Text>
                {hasSavings && (
                  <View
                    style={[
                      styles.savingsBadge,
                      { backgroundColor: `${accentColor}20` },
                    ]}
                  >
                    <Text style={[styles.savingsText, { color: accentColor }]}>
                      Save {formatPrice(savings)}
                    </Text>
                  </View>
                )}
              </View>

              {item.stock !== undefined &&
                item.stock !== null &&
                item.stock > 0 &&
                item.stock <= 5 && (
                  <Text style={[styles.stockWarning, { color: '#EF4444' }]}>
                    Only {item.stock} left
                  </Text>
                )}

              {item.notes && (
                <Text
                  style={[styles.notesText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.notes}
                </Text>
              )}
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
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelContainer: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  gradeText: {
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  savingsBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockWarning: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  notesText: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
});
