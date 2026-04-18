import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import type { EditableProductCondition } from '@/lib/product-condition';

interface VariantConditionEditorProps {
  colors: {
    border: string;
    card: string;
    primary: string;
    text: string;
    textOnPrimary: string;
    textSecondary: string;
  };
  conditionOptions: readonly EditableProductCondition[];
  formatConditionLabel: (condition?: string | null) => string | null;
  updateVariantCondition: (
    index: number,
    condition?: EditableProductCondition
  ) => void;
  variant: EditableProductVariant;
  variantIndex: number;
}

export function VariantConditionEditor({
  colors,
  conditionOptions,
  formatConditionLabel,
  updateVariantCondition,
  variant,
  variantIndex,
}: VariantConditionEditorProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Condition
      </Text>
      <View style={styles.optionsRow}>
        {conditionOptions.map((conditionOption) => {
          const isSelected = variant.condition === conditionOption;

          return (
            <Pressable
              key={conditionOption}
              onPress={() =>
                updateVariantCondition(variantIndex, conditionOption)
              }
              accessibilityRole="radio"
              accessibilityLabel={`${formatConditionLabel(conditionOption)} condition`}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color: isSelected ? colors.textOnPrimary : colors.text,
                  },
                ]}
              >
                {formatConditionLabel(conditionOption)}
              </Text>
            </Pressable>
          );
        })}
        {variant.condition ? (
          <Pressable
            onPress={() => updateVariantCondition(variantIndex, undefined)}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear selected condition"
            style={[
              styles.option,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.optionText, { color: colors.textSecondary }]}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        If any variant uses condition-based pricing, all variants must have a
        condition; otherwise leave blank.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  helperText: {
    fontSize: 12,
  },
  label: {
    marginBottom: SPACING.xs,
  },
  option: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
