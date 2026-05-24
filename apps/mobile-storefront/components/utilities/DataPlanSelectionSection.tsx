import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import type { BillItem } from '@/hooks/use-vtu-billers';
import {
  flattenDataPlanBillItems,
  formatDataPlanAmount,
} from './data-plan-selection';

interface DataPlanSelectionSectionProps {
  billItems: BillItem[];
  colors: typeof Colors.light;
  selectedPlan: string | null;
  onSelectPlan: (billItem: BillItem) => void;
}

export function DataPlanSelectionSection({
  billItems,
  colors,
  selectedPlan,
  onSelectPlan,
}: DataPlanSelectionSectionProps) {
  const plans = flattenDataPlanBillItems(billItems);

  if (plans.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Select Data Package
      </Text>
      <View style={styles.grid}>
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.itemCode;
          const formattedAmount =
            plan.amount > 0 ? formatDataPlanAmount(plan.amount) : null;
          const accessibilityLabel = formattedAmount
            ? `${plan.itemName} - ${formattedAmount}`
            : plan.itemName;

          return (
            <Pressable
              key={plan.itemCode}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectPlan(plan)}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? BRAND.primary : colors.card,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.name,
                  {
                    color: isSelected ? colors.primaryForeground : colors.text,
                  },
                ]}
              >
                {plan.itemName}
              </Text>
              {formattedAmount ? (
                <Text
                  style={[
                    styles.amount,
                    {
                      color: isSelected
                        ? colors.primaryForeground
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {formattedAmount}
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
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 86,
    padding: 14,
    width: '48%',
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
});
