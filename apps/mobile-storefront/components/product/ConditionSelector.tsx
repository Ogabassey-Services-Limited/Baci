/**
 * Condition Selector Component
 * Allows users to select product condition (New, Used, Refurbished, etc.)
 * Updates pricing based on selected condition offer
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { RADIUS, SPACING } from '@/constants/Colors';
import {
  formatProductConditionDisplay,
  formatPrice,
  type ProductCondition,
  type ProductConditionOffer,
} from '@/types/product';

interface ConditionSelectorProps {
  currentCondition: string | undefined;
  offers: ProductConditionOffer[];
  selectedCondition: ProductCondition | null;
  onSelect: (condition: ProductCondition) => void;
  basePrice: number;
}

const CONDITION_CONFIG: Record<
  ProductCondition,
  { icon: string; color: string; description: string }
> = {
  new: {
    icon: 'sparkles',
    color: '#10B981',
    description: 'Brand new, sealed',
  },
  used: {
    icon: 'refresh',
    color: '#F59E0B',
    description: 'Pre-owned, tested',
  },
  uk_used: {
    icon: 'airplane',
    color: '#3B82F6',
    description: 'Imported, pre-owned',
  },
  open_box: {
    icon: 'cube-outline',
    color: '#8B5CF6',
    description: 'Opened, never used',
  },
  refurbished: {
    icon: 'construct',
    color: '#06B6D4',
    description: 'Restored to like-new',
  },
};

const GRADE_LABELS: Record<string, string> = {
  A: 'Like New',
  B: 'Good',
  C: 'Fair',
  D: 'Acceptable',
};

export function ConditionSelector({
  currentCondition,
  offers,
  selectedCondition,
  onSelect,
  basePrice,
}: ConditionSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Normalize current condition to match our condition type
  const normalizeCondition = (cond: string | undefined): ProductCondition => {
    if (!cond) return 'new';
    const lower = cond.toLowerCase().replace(/\s+/g, '_');
    if (lower.includes('uk')) return 'uk_used';
    if (lower.includes('refurb')) return 'refurbished';
    if (lower.includes('open')) return 'open_box';
    if (lower.includes('used')) return 'used';
    return 'new';
  };

  const baseCondition = normalizeCondition(currentCondition);

  // Build available conditions from offers + base condition
  const availableConditions: Array<{
    condition: ProductCondition;
    price: number;
    comparePrice?: number;
    stock?: number;
    grade?: string;
    notes?: string;
  }> = [];

  // Add base condition (the product's default)
  availableConditions.push({
    condition: baseCondition,
    price: basePrice,
    stock: undefined,
  });

  // Add offers that differ from base condition
  for (const offer of offers) {
    if (offer.condition !== baseCondition) {
      availableConditions.push({
        condition: offer.condition,
        price: offer.price,
        comparePrice: offer.compare_at_price,
        stock: offer.stock_quantity,
        grade: offer.grade,
        notes: offer.condition_notes,
      });
    }
  }

  // If only one condition available, don't show selector
  if (availableConditions.length <= 1) {
    return null;
  }

  const effectiveSelected = selectedCondition || baseCondition;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Condition</Text>
      <View style={styles.optionsContainer}>
        {availableConditions.map((item) => {
          const config = CONDITION_CONFIG[item.condition];
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
                    ? `${config.color}15`
                    : colors.card,
                  borderColor: isSelected ? config.color : colors.border,
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
                    { backgroundColor: `${config.color}20` },
                  ]}
                >
                  <Ionicons
                    name={
                      config.icon as React.ComponentProps<
                        typeof Ionicons
                      >['name']
                    }
                    size={16}
                    color={config.color}
                  />
                </View>
                <View style={styles.labelContainer}>
                  <Text
                    style={[
                      styles.conditionLabel,
                      { color: isSelected ? config.color : colors.text },
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
                    color={config.color}
                  />
                )}
              </View>

              <View style={styles.priceRow}>
                <Text
                  style={[
                    styles.priceText,
                    { color: isSelected ? config.color : colors.text },
                  ]}
                >
                  {formatPrice(item.price)}
                </Text>
                {hasSavings && (
                  <View
                    style={[
                      styles.savingsBadge,
                      { backgroundColor: `${config.color}20` },
                    ]}
                  >
                    <Text style={[styles.savingsText, { color: config.color }]}>
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
