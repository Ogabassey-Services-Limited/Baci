import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type {
  VariantOptionGroup,
  VariantOptionValue,
} from '@/lib/product-variant-option-selector';

interface ProductVariantSelectableGroupProps {
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'card'
    | 'primary'
    | 'text'
    | 'textMuted'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  group: VariantOptionGroup;
  onSelect: (key: string, value: string, available: boolean) => void;
  visibleValues: VariantOptionValue[];
}

export function ProductVariantSelectableGroup({
  colors,
  group,
  onSelect,
  visibleValues,
}: ProductVariantSelectableGroupProps) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {group.label}
      </Text>
      <View style={styles.options} testID={`variant-options-${group.key}`}>
        {visibleValues.map((option) => {
          const isUnavailable = !(option.available || option.selected);

          return (
            <View
              key={`${group.key}:${option.value}`}
              style={[
                styles.option,
                {
                  backgroundColor: option.selected
                    ? colors.primary
                    : colors.card,
                  borderColor: option.selected ? colors.primary : colors.border,
                  opacity: isUnavailable ? 0.48 : 1,
                },
              ]}
            >
              <Pressable
                accessibilityLabel={`Select ${group.label} ${option.label}`}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isUnavailable,
                  selected: option.selected,
                }}
                disabled={isUnavailable}
                onPress={() =>
                  onSelect(group.key, option.value, option.available)
                }
                style={styles.optionPressable}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: option.selected
                        ? colors.textOnPrimary
                        : isUnavailable
                          ? colors.textMuted
                          : colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionPressable: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
